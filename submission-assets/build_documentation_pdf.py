from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "submission-assets" / "ModelAtlas_Documentation.pdf"
PAGE_W, PAGE_H = A4
MARGIN_X = 17 * mm
TOP = 18 * mm
BOTTOM = 16 * mm

INK = colors.black
SLATE = colors.HexColor("#222222")
MUTED = colors.HexColor("#555555")
PAPER = colors.white
CARD = colors.white
LINE = colors.HexColor("#B8B8B8")
ORANGE = colors.black
BLUE = colors.black
GREEN = colors.black
PURPLE = colors.black

FONT_REGULAR = "Helvetica"
FONT_MEDIUM = "Helvetica"
FONT_DEMI = "Helvetica-Bold"
FONT_BOLD = "Helvetica-Bold"
FONT_ITALIC = "Helvetica-Oblique"

try:
    avenir = "/System/Library/Fonts/Avenir Next.ttc"
    pdfmetrics.registerFont(TTFont("AvenirNext-Bold", avenir, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("AvenirNext-Demi", avenir, subfontIndex=2))
    pdfmetrics.registerFont(TTFont("AvenirNext-Medium", avenir, subfontIndex=5))
    pdfmetrics.registerFont(TTFont("AvenirNext-Regular", avenir, subfontIndex=7))
    pdfmetrics.registerFont(TTFont("AvenirNext-Italic", avenir, subfontIndex=4))
    FONT_REGULAR = "AvenirNext-Regular"
    FONT_MEDIUM = "AvenirNext-Medium"
    FONT_DEMI = "AvenirNext-Demi"
    FONT_BOLD = "AvenirNext-Bold"
    FONT_ITALIC = "AvenirNext-Italic"
except Exception:
    pass


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kicker", parent=styles["Normal"], fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=ORANGE, spaceAfter=7))
styles.add(ParagraphStyle(name="TitleCustom", parent=styles["Title"], fontName=FONT_BOLD, fontSize=31, leading=34, textColor=INK, alignment=TA_LEFT, spaceAfter=8))
styles.add(ParagraphStyle(name="Subtitle", parent=styles["Normal"], fontName=FONT_REGULAR, fontSize=12, leading=17, textColor=SLATE, spaceAfter=15))
styles.add(ParagraphStyle(name="H1Custom", parent=styles["Heading1"], fontName=FONT_BOLD, fontSize=20, leading=24, textColor=INK, spaceBefore=0, spaceAfter=8))
styles.add(ParagraphStyle(name="H2Custom", parent=styles["Heading2"], fontName=FONT_DEMI, fontSize=12.5, leading=15, textColor=INK, spaceBefore=7, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyCustom", parent=styles["BodyText"], fontName=FONT_REGULAR, fontSize=9.4, leading=13.5, textColor=SLATE, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallCustom", parent=styles["BodyText"], fontName=FONT_REGULAR, fontSize=8, leading=10.8, textColor=SLATE, spaceAfter=3))
styles.add(ParagraphStyle(name="TinyCustom", parent=styles["BodyText"], fontName=FONT_REGULAR, fontSize=6.8, leading=8.8, textColor=MUTED, spaceAfter=2))
styles.add(ParagraphStyle(name="CardTitle", parent=styles["BodyText"], fontName=FONT_DEMI, fontSize=9.4, leading=12, textColor=INK, spaceAfter=3))
styles.add(ParagraphStyle(name="CardBody", parent=styles["BodyText"], fontName=FONT_REGULAR, fontSize=8.3, leading=11.8, textColor=SLATE, spaceAfter=0))
styles.add(ParagraphStyle(name="Quote", parent=styles["BodyText"], fontName=FONT_ITALIC, fontSize=10.4, leading=15, textColor=INK, leftIndent=8, borderPadding=8, borderColor=ORANGE, borderWidth=0, borderLeft=2, spaceAfter=8))
styles.add(ParagraphStyle(name="Link", parent=styles["BodyText"], fontName=FONT_REGULAR, fontSize=8.5, leading=12, textColor=INK))


def p(text, style):
    return Paragraph(text, style)


def accent_rule(width=45 * mm, color=ORANGE):
    table = Table([[""]], colWidths=[width], rowHeights=[1.8])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color), ("LINEBELOW", (0, 0), (-1, -1), 0, color)]))
    return table


def card(title, body, width=82 * mm, accent=ORANGE):
    table = Table([[p(title, styles["CardTitle"])], [p(body, styles["CardBody"])]], colWidths=[width])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LINEBEFORE", (0, 0), (0, -1), 1.5, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def section(number, title, intro):
    return [
        p(f"<font color='#000000'>{number}</font>  {title}", styles["H1Custom"]),
        accent_rule(),
        Spacer(1, 5),
        p(intro, styles["BodyCustom"]),
        Spacer(1, 3),
    ]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    if doc.page > 1:
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, PAGE_H - 11 * mm, PAGE_W - MARGIN_X, PAGE_H - 11 * mm)
        canvas.setFont(FONT_BOLD, 7.5)
        canvas.setFillColor(INK)
        canvas.drawString(MARGIN_X, PAGE_H - 8 * mm, "MODELATLAS")
        canvas.setFont(FONT_REGULAR, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 8 * mm, "CodeFury 9.0 / AI Marketplace")
    canvas.setStrokeColor(LINE)
    canvas.line(MARGIN_X, 10 * mm, PAGE_W - MARGIN_X, 10 * mm)
    canvas.setFont(FONT_REGULAR, 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN_X, 6.5 * mm, "LARP / ModelAtlas - CodeFury 9.0 submission")
    canvas.drawRightString(PAGE_W - MARGIN_X, 6.5 * mm, str(doc.page))
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT), pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=TOP, bottomMargin=BOTTOM,
        title="ModelAtlas - CodeFury 9.0 Solution Document", author="ModelAtlas",
    )
    frame = Frame(MARGIN_X, BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - TOP - BOTTOM, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    story = []

    # Page 1 - the story at a glance
    story += [Spacer(1, 6 * mm), p("CODEFURY 9.0 / SOLUTION DOCUMENT", styles["Kicker"]), p("ModelAtlas", styles["TitleCustom"]), p("The decision layer before you spend on AI.", styles["Subtitle"]), accent_rule(54 * mm), Spacer(1, 8 * mm)]
    meta = Table([
        [p("THEME", styles["TinyCustom"]), p("APPLICATION", styles["TinyCustom"]), p("TEAM / PROJECT", styles["TinyCustom"])],
        [p("AI Marketplace", styles["CardTitle"]), p("Web application", styles["CardTitle"]), p("LARP / ModelAtlas", styles["CardTitle"])],
    ], colWidths=[54 * mm, 54 * mm, 54 * mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD), ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story += [meta, Spacer(1, 12 * mm), p("A simple way to move from an unclear AI idea to a decision a team can explain and act on.", styles["Subtitle"]), Spacer(1, 8 * mm)]
    story.append(card("The idea in one sentence", "ModelAtlas helps a person or a business decide what AI to use, where to run it, and what it will really cost - before they buy anything.", width=174 * mm, accent=ORANGE))
    story.append(Spacer(1, 5 * mm))
    story.append(card("The short version", "Start with the work. Set the privacy boundary. Check the hardware. Compare the options that fit. Leave with a plan, not a shopping cart.", width=174 * mm, accent=BLUE))
    story.append(PageBreak())

    # Page 2 - problem and flow
    story += section("01", "Why this is needed", "Choosing AI is confusing because people are asked to choose a model and a machine before they have described the job.")
    story.append(p("Consider an Indian manufacturing company. Finance has invoices and scanned paperwork. Operations has spreadsheets and inventory information. Support has product images and internal documents. The team wants a private document assistant, but it does not know whether to use an external API, a local model, a cloud GPU, or the machines it already owns.", styles["BodyCustom"]))
    story.append(p("It needs more than a model catalogue. It needs a decision it can explain to a manager, check with its IT team, and turn into a practical plan. That is the job of ModelAtlas.", styles["Quote"]))
    story.append(p("<b>How the product works</b>", styles["H2Custom"]))
    steps = [
        ("1. Start with the work", "The user explains the job in normal language. ModelAtlas turns it into a clear profile."),
        ("2. Set the boundaries", "The user chooses how private the work is. Unsuitable external options are removed early."),
        ("3. Check what exists", "Screenshots, invoices, or specifications help verify the hardware already available."),
        ("4. Compare what fits", "The product explains capability, hosting, cost, assumptions, and risks."),
        ("5. Leave with a plan", "The result can move into a team workspace and become an implementation plan."),
    ]
    step_rows = []
    for i in range(0, len(steps), 2):
        left = card(steps[i][0], steps[i][1], width=82 * mm, accent=ORANGE if i == 0 else BLUE)
        right = card(steps[i + 1][0], steps[i + 1][1], width=82 * mm, accent=GREEN if i == 2 else PURPLE) if i + 1 < len(steps) else ""
        step_rows.append([left, right])
    steps_table = Table(step_rows, colWidths=[87 * mm, 87 * mm])
    steps_table.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(steps_table)
    story.append(Spacer(1, 4 * mm))
    story.append(card("The outcome", "The product does not tell the user to buy the most expensive model. It helps them choose the simplest option that meets the workload, privacy, and budget requirements.", width=174 * mm, accent=GREEN))
    story.append(PageBreak())

    # Page 3 - product and differentiation
    story += section("02", "What judges can try", "The seeded demo is designed to tell one complete story from a business need to a team-ready plan.")
    features = [
        ("Personal Explorer", "Describe a workload without needing model or infrastructure knowledge.", ORANGE),
        ("Privacy filter", "Choose public, internal, confidential, or highly sensitive and see the effect on eligibility.", colors.black),
        ("Hardware check", "Review evidence and see which details are confirmed or still need a human check.", BLUE),
        ("Recommendation", "See one primary option, alternatives, trade-offs, risks, and verification tasks.", GREEN),
        ("Research Scout", "Check official, benchmark, procurement, and community information with the source and date visible.", PURPLE),
        ("Cost comparison", "See hardware, shipping, tax, electricity, usage, and other assumptions separately.", ORANGE),
        ("Team workspace", "Keep role details private while combining the useful context into one shared opportunity.", BLUE),
        ("Implementation plan", "Turn the recommendation into architecture, steps, risks, approvals, and success measures.", GREEN),
    ]
    rows = []
    for i in range(0, len(features), 2):
        rows.append([card(features[i][0], features[i][1], width=82 * mm, accent=features[i][2]), card(features[i + 1][0], features[i + 1][1], width=82 * mm, accent=features[i + 1][2])])
    feature_table = Table(rows, colWidths=[87 * mm, 87 * mm])
    feature_table.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(feature_table)
    story.append(Spacer(1, 2 * mm))
    story.append(p("<b>What makes the approach different</b>", styles["H2Custom"]))
    story.append(p("Most model catalogues begin with model names. ModelAtlas begins with the user's work and removes unsuitable choices before ranking the rest. It treats privacy as a boundary, keeps cost assumptions visible, and avoids presenting a confident answer when the evidence still needs checking.", styles["BodyCustom"]))
    story.append(card("Why it belongs in AI Marketplace", "ModelAtlas supports discovery, evaluation, trust, cost comparison, procurement guidance, and deployment planning. It provides outbound links, but it does not pretend to be a checkout or provisioning system.", width=174 * mm, accent=ORANGE))
    story.append(PageBreak())

    # Page 4 - prompts and responsible use
    story += section("03", "How AI is used responsibly", "AI helps with questions, explanations, and research. The important boundaries remain visible to the user.")
    story.append(p("<b>Prompts implemented in the application</b>", styles["H2Custom"]))
    prompts = [
        ("Intake Copilot", "Asks for the most important missing detail one question at a time and helps turn a plain-language description into a workload profile."),
        ("ModelAtlas Assistant", "Explains recommendations clearly, follows the privacy boundary, does not invent prices or benchmarks, and warns when hardware cannot be combined safely."),
        ("Research Scout", "Helps check current model, benchmark, availability, and price information and keeps the source, date, and confidence visible."),
    ]
    prompt_rows = [[p(name, styles["CardTitle"]), p(body, styles["CardBody"])] for name, body in prompts]
    prompt_table = Table(prompt_rows, colWidths=[43 * mm, 131 * mm])
    prompt_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD), ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(prompt_table)
    story.append(Spacer(1, 7 * mm))
    story.append(p("<b>Simple rules behind the experience</b>", styles["H2Custom"]))
    for title, body, accent in [
        ("Privacy comes first", "Confidential work cannot quietly be sent to an unsuitable external service.", colors.black),
        ("Evidence stays visible", "Important claims show where they came from, when they were checked, and how confident the system is.", BLUE),
        ("The assistant does not decide alone", "Policy, cost, ranking, and hardware checks remain explicit instead of being hidden inside a chat response.", GREEN),
        ("The demo is reliable", "Seeded demo mode lets judges follow the complete journey without API keys or live scraping.", ORANGE),
    ]:
        story.append(card(title, body, width=174 * mm, accent=accent))
        story.append(Spacer(1, 3 * mm))
    story.append(p("The application also supports secure authentication and private data access. It does not provision servers, process a purchase, or send confidential documents to an external provider merely to answer a question.", styles["BodyCustom"]))
    story.append(PageBreak())

    # Page 5 - solution statement, visual proof, and handoff
    story += section("04", "The solution and the submission", "This is the short version a judge can read first, followed by the links needed to try the product.")
    story.append(p("<b>Solution to the problem statement</b>", styles["H2Custom"]))
    solution = "ModelAtlas solves the AI Marketplace problem by helping people make a buying decision in the right order. A user starts with the work they want to improve, not with a model name. They describe the documents, images, request volume, users, budget, location, and privacy needs. ModelAtlas turns that description into a clear workload profile. It then removes options that do not meet the privacy or hardware requirements, checks the evidence for the equipment already available, and compares the remaining options on capability, hosting, cost, and setup effort. Each important claim is shown with its source and confidence. For an Indian manufacturing company, the platform also separates hardware price, shipping, tax, electricity, and usage costs instead of showing one vague number. A team can keep individual role details private, combine the useful parts into a shared opportunity, and produce an implementation plan. The built-in assistant explains the recommendation in simple language, while Research Scout helps check current facts. ModelAtlas does not pretend to be a checkout or provisioning tool; it gives the team a decision they can understand, discuss, and act on."
    story.append(p(solution, styles["Quote"]))
    story.append(p("<b>Judge walkthrough</b>", styles["H2Custom"]))
    for step in [
        "Open the landing page and start a seeded decision.",
        "Describe the manufacturing document workflow and confirm Confidential privacy.",
        "Review the Mac Studio and RTX 4090 hardware evidence.",
        "Choose Privacy / Local-First and compare the recommendation, costs, alternatives, and sources.",
        "Move the decision into the team workspace and open the implementation plan.",
    ]:
        story.append(p(f"<b>•</b> {step}", styles["SmallCustom"]))
    story.append(Spacer(1, 3 * mm))
    links = [
        [p("GitHub", styles["CardTitle"]), p('<link href="https://github.com/jagathsrujan/modelatlas1"><u>Open GitHub repository</u></link>', styles["Link"])],
        [p("Hosted website", styles["CardTitle"]), p('<link href="https://modelatlas1.vercel.app/"><u>Open hosted website</u></link>', styles["Link"])],
        [p("Demo video", styles["CardTitle"]), p('Video file: <b>demo</b><br/><link href="https://drive.google.com/drive/folders/1IDePrOSCO3KlUjUc9gPjhMADEKS5Q7WO?usp=share_link"><u>Open Google Drive folder</u></link>', styles["SmallCustom"])],
        [p("Team and member", styles["CardTitle"]), p("LARP - Jagath Srujan", styles["SmallCustom"])],
    ]
    link_table = Table(links, colWidths=[43 * mm, 131 * mm])
    link_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD), ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(link_table)
    story.append(Spacer(1, 5 * mm))
    story.append(p("<b>Institution and contact</b> - University of Visvesvaraya College of Engineering | jagathsrujan@zohomail.in | +91 9483228266", styles["TinyCustom"]))
    story.append(p("<b>Required uploads</b> - solution document on Google Drive, GitHub repository, hosted website link, and public demo video. This is a web-only submission; no Android APK is included.", styles["SmallCustom"]))

    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    build()
