import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/persistence/repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const useLocal = isDemoQuery || !hasEnv;

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { userId = null; }

  try {
    let repo = await getRepository({ isDemo: useLocal ? true : false });
    let profile = await repo.getSeller(id);
    // Fallback to local seed if Supabase table missing (PGRST205) and local has seller — keeps demo green
    if (!profile && !useLocal) {
      const localRepo = await getRepository({ isDemo: true });
      const localProfile = await localRepo.getSeller(id);
      if (localProfile) {
        profile = localProfile;
        repo = localRepo;
      } else {
        return NextResponse.json({ error: "Seller not found" }, { status: 404 });
      }
    } else if (!profile) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }
    // Rejected/suspended never visible to others
    if (profile.verification_status === "rejected" || profile.verification_status === "suspended") {
      if (userId !== profile.id) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }
    // Demo/Local allows unverified/pending for discovery (cold-start liquidity, badged)
    // Live strict enforces: non-owner sees verified only (RLS: verified OR own)
    if (!(isDemoQuery || useLocal)) {
      if (profile.verification_status !== "verified" && userId !== profile.id) {
        return NextResponse.json({ error: "Seller not found" }, { status: 404 });
      }
    }

    // Fetch listings: active only unless own
    const isOwner = userId === profile.id;
    const listings = await repo.listListings(profile.id, { includeDrafts: isOwner, requesterId: userId });

    return NextResponse.json({ seller: profile, listings }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
