from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(r"C:\Users\s-bas\aws-file-analyzer")
OUTPUT = ROOT / "output" / "pdf" / "Brad_Asher_AWS_File_Analyzer_Project_Brief.pdf"

INK = colors.HexColor("#17212B")
NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#2F6B8A")
AWS = colors.HexColor("#C56A12")
MUTED = colors.HexColor("#59636E")
LINE = colors.HexColor("#C9D3DC")
PALE_BLUE = colors.HexColor("#EEF5F8")
PALE_ORANGE = colors.HexColor("#FFF4E8")
PALE_GRAY = colors.HexColor("#F4F6F8")
WHITE = colors.white


def register_fonts():
    pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))


def p(text, style):
    return Paragraph(text, style)


class ArchitectureFlow(Flowable):
    def __init__(self, width):
        super().__init__()
        self.width = width
        self.height = 1.78 * inch

    @staticmethod
    def _arrow_path(canvas, x, y, direction="right"):
        path = canvas.beginPath()
        if direction == "right":
            path.moveTo(x, y)
            path.lineTo(x - 6, y + 3)
            path.lineTo(x - 6, y - 3)
        else:
            path.moveTo(x, y)
            path.lineTo(x - 3, y + 6)
            path.lineTo(x + 3, y + 6)
        path.close()
        return path

    def _box(self, c, x, y, w, h, title, detail, fill=WHITE, accent=BLUE):
        c.setFillColor(fill)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
        c.setFillColor(accent)
        c.rect(x, y + h - 4, w, 4, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Arial-Bold", 7.5)
        c.drawCentredString(x + w / 2, y + h - 16, title)
        c.setFillColor(MUTED)
        c.setFont("Arial", 6.25)
        baseline = y + h - 28
        for line in detail.split("|"):
            c.drawCentredString(x + w / 2, baseline, line)
            baseline -= 8

    def draw(self):
        c = self.canv
        top_y = 1.02 * inch
        top_h = 0.62 * inch
        side_w = 1.47 * inch
        api_w = 2.15 * inch
        left_x = 0
        api_x = (self.width - api_w) / 2
        right_x = self.width - side_w

        self._box(c, left_x, top_y, side_w, top_h, "CLOUDFLARE SPA", "React 19 and Vite|JWT client and gallery", PALE_GRAY)
        self._box(c, api_x, top_y, api_w, top_h, "AZURE APP SERVICE API", ".NET 8 orchestration|validation and rate limits", PALE_BLUE)
        self._box(c, right_x, top_y, side_w, top_h, "STRUCTURED RESULT", "summary or image metadata|browser speech and map", PALE_GRAY)

        c.setStrokeColor(BLUE)
        c.setFillColor(BLUE)
        c.setLineWidth(1.0)
        y_mid = top_y + top_h / 2
        c.line(left_x + side_w + 3, y_mid, api_x - 5, y_mid)
        c.drawPath(self._arrow_path(c, api_x, y_mid), fill=1, stroke=0)
        c.line(api_x + api_w + 3, y_mid, right_x - 5, y_mid)
        c.drawPath(self._arrow_path(c, right_x, y_mid), fill=1, stroke=0)

        services = [
            ("KEY VAULT", "managed identity|resolves secrets", PALE_BLUE, BLUE),
            ("PRIVATE S3", "object storage|60 minute URLs", PALE_ORANGE, AWS),
            ("AZURE SQL", "metadata and|analysis cache", PALE_BLUE, BLUE),
            ("GEMINI", "image PDF and text|model fallback", PALE_GRAY, BLUE),
        ]
        gap = 0.16 * inch
        box_w = (self.width - 3 * gap) / 4
        box_h = 0.62 * inch
        service_y = 0.08 * inch
        bus_y = service_y + box_h + 0.11 * inch
        c.line(api_x + api_w / 2, top_y, api_x + api_w / 2, bus_y)
        c.line(box_w / 2, bus_y, self.width - box_w / 2, bus_y)
        for i, (title, detail, fill, accent) in enumerate(services):
            x = i * (box_w + gap)
            center = x + box_w / 2
            c.line(center, bus_y, center, service_y + box_h + 5)
            c.drawPath(self._arrow_path(c, center, service_y + box_h, "down"), fill=1, stroke=0)
            self._box(c, x, service_y, box_w, box_h, title, detail, fill, accent)


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Arial-Bold",
            fontSize=20,
            leading=23,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=3,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName="Arial",
            fontSize=10.1,
            leading=13,
            textColor=MUTED,
            spaceAfter=7,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=base["Normal"],
            fontName="Arial",
            fontSize=8.6,
            leading=11,
            textColor=MUTED,
            spaceAfter=11,
        ),
        "h1": ParagraphStyle(
            "Heading1",
            parent=base["Heading1"],
            fontName="Arial-Bold",
            fontSize=11.4,
            leading=14,
            textColor=INK,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Arial",
            fontSize=9.25,
            leading=12.45,
            textColor=INK,
            spaceAfter=5,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=base["BodyText"],
            fontName="Arial",
            fontSize=7.8,
            leading=10.15,
            textColor=INK,
        ),
        "cell_head": ParagraphStyle(
            "CellHead",
            parent=base["BodyText"],
            fontName="Arial-Bold",
            fontSize=7.5,
            leading=9.2,
            textColor=WHITE,
        ),
        "stat": ParagraphStyle(
            "Stat",
            parent=base["BodyText"],
            fontName="Arial-Bold",
            fontSize=10.1,
            leading=11.4,
            textColor=NAVY,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Arial",
            fontSize=8.2,
            leading=10.8,
            textColor=INK,
        ),
    }


def styled_table(rows, widths, padding=5):
    table = Table(rows, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE_BLUE]),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), padding),
        ("BOTTOMPADDING", (0, 0), (-1, -1), padding),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return table


def build_pdf():
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = make_styles()

    page_w, page_h = LETTER
    left = right = 0.70 * inch
    top = 0.58 * inch
    bottom = 0.53 * inch
    usable_w = page_w - left - right
    frame = Frame(left, bottom, usable_w, page_h - top - bottom, id="main")

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(MUTED)
        canvas.setFont("Arial", 7.2)
        canvas.drawString(left, 0.27 * inch, "AWS File Analyzer")
        canvas.drawRightString(page_w - right, 0.27 * inch, f"Brad Asher  |  {doc.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=LETTER,
        leftMargin=left,
        rightMargin=right,
        topMargin=top,
        bottomMargin=bottom,
        title="AWS File Analyzer Technical Project Brief",
        author="Brad Asher",
        subject="Software engineering internship project writeup",
    )
    doc.addPageTemplates([PageTemplate(id="brief", frames=[frame], onPage=footer)])

    story = []
    story.append(p("AWS File Analyzer", styles["title"]))
    story.append(p("Multi-cloud file ingestion and AI analysis platform", styles["subtitle"]))
    story.append(p(
        'Brad Asher &nbsp;&nbsp;|&nbsp;&nbsp; .NET 8 and React 19 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<link href="https://github.com/BradshawAsher/aws-file-analyzer" color="#2F6B8A">GitHub</link>'
        ' &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<link href="https://aws-file-analyzer.pages.dev" color="#2F6B8A">Live application</link>',
        styles["meta"],
    ))

    story.append(p("Project overview", styles["h1"]))
    story.append(p(
        "I built a deployed document intelligence application that accepts images, PDFs, and text files, stores them privately in Amazon S3, and returns structured analysis from Google Gemini. A React single-page application runs on Cloudflare Pages, while a .NET 8 API on Azure App Service coordinates authentication, storage, model calls, and Azure SQL persistence.",
        styles["body"],
    ))
    story.append(p(
        "The project focuses on the boundaries that make a cloud AI feature usable outside a local demo. The API validates file count, size, type, and source URL; signs temporary S3 access instead of exposing the bucket; checks a SQL cache before repeating model work; limits guest capabilities; and retries transient Gemini failures through an ordered model fallback chain.",
        styles["body"],
    ))

    stats = Table([[
        p("4 providers<br/><font name='Arial' size='7.0' color='#59636E'>Cloudflare Azure AWS Google</font>", styles["stat"]),
        p("55 of 55<br/><font name='Arial' size='7.0' color='#59636E'>local CI tests passing</font>", styles["stat"]),
        p("60 minutes<br/><font name='Arial' size='7.0' color='#59636E'>signed S3 URL lifetime</font>", styles["stat"]),
        p("8 models<br/><font name='Arial' size='7.0' color='#59636E'>cost-first Gemini fallback</font>", styles["stat"]),
    ]], colWidths=[usable_w / 4] * 4)
    stats.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_GRAY),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(Spacer(1, 3))
    story.append(stats)

    story.append(p("Architecture", styles["h1"]))
    story.append(ArchitectureFlow(usable_w))

    story.append(p("Core design", styles["h1"]))
    core_rows = [
        [p("COMPONENT", styles["cell_head"]), p("IMPLEMENTATION AND PURPOSE", styles["cell_head"])],
        [p("Ingestion and storage", styles["cell"]), p("The API uploads as many as five account files concurrently with Task.WhenAll. Objects remain private in S3, and 60-minute pre-signed URLs give the backend temporary read access without placing AWS credentials in the browser.", styles["cell"])],
        [p("File analysis pipeline", styles["cell"]), p("A dispatcher selects image, PDF, or text processing. Images are sent as inline multimodal data; PdfPig extracts PDF text and summarizes long documents in 4,000-character chunks; text and HTML use a dedicated summary path.", styles["cell"])],
        [p("Persistence and reuse", styles["cell"]), p("EF Core repositories and a Unit of Work persist upload metadata and structured analysis in Azure SQL. The service checks for an existing result before invoking Gemini and serializes database writes through a short semaphore-protected section.", styles["cell"])],
        [p("Identity and operations", styles["cell"]), p("BCrypt credentials, Google ID tokens, JWT roles, per-route rate limits, MIME and size limits, S3 URL allowlisting, global problem responses, health checks, and Application Insights define the production boundary.", styles["cell"])],
    ]
    story.append(styled_table(core_rows, [1.38 * inch, usable_w - 1.38 * inch], padding=4.7))

    story.append(PageBreak())

    story.append(p("Engineering decisions and tradeoffs", styles["title"]))
    story.append(p(
        "I kept each provider responsible for a distinct concern and made failure handling explicit in the application layer. That produced a working cross-cloud system, while leaving several clear improvements for a larger deployment.",
        styles["body"],
    ))

    decisions = [
        [p("DECISION", styles["cell_head"]), p("WHY IT WORKS", styles["cell_head"]), p("CURRENT COST", styles["cell_head"])],
        [p("Separate edge UI and API", styles["cell"]), p("Cloudflare serves the static React build, while Azure hosts the stateful .NET API, SQL access, monitoring, and managed identity.", styles["cell"]), p("Cross-origin configuration and two deployment pipelines must stay synchronized.", styles["cell"])],
        [p("Private S3 plus signed reads", styles["cell"]), p("Users never receive AWS credentials and the bucket does not need public access. The server can renew links from stored object keys.", styles["cell"]), p("A pre-signed URL is still a bearer capability until it expires, so URL validation and short lifetimes matter.", styles["cell"])],
        [p("SQL-backed result cache", styles["cell"]), p("Repeated analysis can return stored structured output instead of paying for another Gemini request.", styles["cell"]), p("The current lookup uses the temporary URL. A stable object key or content hash would improve cache identity across renewed URLs.", styles["cell"])],
        [p("Parallel work with bounded writes", styles["cell"]), p("S3 uploads and file analyses run concurrently, while EF Core writes enter a small serialized critical section.", styles["cell"]), p("The in-process semaphore does not coordinate multiple API instances; database constraints and idempotent writes are the scalable boundary.", styles["cell"])],
        [p("Cost-first model fallback", styles["cell"]), p("Transient errors, rate limits, and unavailable models trigger bounded retry and progression through eight configured Gemini Flash models.", styles["cell"]), p("Different fallback models can vary in latency and output. Usage telemetry is needed to tune the order with evidence.", styles["cell"])],
    ]
    story.append(styled_table(decisions, [1.42 * inch, 2.72 * inch, usable_w - 4.14 * inch], padding=5.2))

    story.append(p("Verification and production evidence", styles["h1"]))
    verification_rows = [
        [p("CHECK", styles["cell_head"]), p("LATEST RESULT", styles["cell_head"]), p("WHAT IT COVERS", styles["cell_head"])],
        [p("Backend tests", styles["cell"]), p("26 of 26 passing", styles["cell"]), p("JWT, controllers, file validation, service dispatch, and Gemini fallback behavior", styles["cell"])],
        [p("Frontend tests", styles["cell"]), p("29 of 29 passing", styles["cell"]), p("routing, auth forms, token handling, guest landing, API client, and gallery behavior", styles["cell"])],
        [p("Production build", styles["cell"]), p("Vite build succeeds", styles["cell"]), p("83 modules transformed into deployable static assets", styles["cell"])],
        [p("Live deployment", styles["cell"]), p("Frontend and API health return HTTP 200", styles["cell"]), p("A separate 10-scenario Playwright suite exercises guest, auth, gallery, and navigation flows", styles["cell"])],
    ]
    story.append(styled_table(verification_rows, [1.18 * inch, 1.42 * inch, usable_w - 2.60 * inch], padding=4.8))

    story.append(p("Security boundaries and next steps", styles["h1"]))
    story.append(p(
        "Azure Key Vault supplies JWT, Gemini, and AWS secrets to App Service through system-assigned managed identity, and GitHub Actions deploys to Azure through OIDC. Guest JWTs expire after 15 minutes and can upload one file up to 2 MB; account users can upload as many as five files up to 5 MB each. The next engineering work is to add durable per-user ownership for uploads and analysis rows, replace URL-based cache identity with object keys or hashes, trace requests across all four providers with OpenTelemetry, and move from long-lived AWS keys to temporary federated credentials.",
        styles["body"],
    ))

    story.append(p("What this project demonstrates", styles["h1"]))
    story.append(p(
        "This project required full-stack implementation across HTTP APIs, asynchronous I/O, authentication, relational persistence, cloud storage, external model reliability, infrastructure as code, CI, and public deployment. More importantly, it forced me to define trust boundaries and failure behavior between services that do not share one cloud, identity system, or availability model.",
        styles["body"],
    ))

    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
