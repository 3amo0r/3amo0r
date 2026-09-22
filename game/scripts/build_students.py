#!/usr/bin/env python3
"""
build_students.py — turns a folder of baby photos into game data.

Two modes:

  1. Import real photos (what you run once you've downloaded the Drive folder):

         python3 scripts/build_students.py --import ~/Downloads/BabyPhotos

     Every image in the folder becomes one student. The file name becomes the
     student's name ("Omar Elsayed.HEIC" -> "Omar Elsayed"), the image is cropped
     square, resized to 64x64 and saved as WebP into public/students/.

  2. Generate a placeholder roster (already run for you, so the game is playable
     before the photos land):

         python3 scripts/build_students.py --placeholder 188

Re-running --import never loses hand-edits: nicknames, quotes and stage numbers
already present in src/data/students.json are carried over by matching on name.

Requires Pillow. For iPhone .HEIC files also install pillow-heif:

    pip install Pillow pillow-heif
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STUDENTS_JSON = ROOT / "src" / "data" / "students.json"
PHOTO_DIR = ROOT / "public" / "students"

PHOTO_SIZE = 64
WEBP_QUALITY = 82
TOTAL_STAGES = 5

IMAGE_SUFFIXES = {
    ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
    ".bmp", ".gif", ".tif", ".tiff", ".jfif", ".avif",
}

# Junk that phones and Drive staple onto file names.
NOISE = re.compile(
    r"(IMG|PHOTO|WhatsApp Image|WhatsApp|Screenshot|Picsart|FB_IMG|"
    r"Snapchat|received|image|DSC|_MG|VID)[-_ ]*",
    re.IGNORECASE,
)
TRAILING_JUNK = re.compile(r"[-_ ]*\(?\d{2,}\)?$")
MULTISPACE = re.compile(r"\s+")

# Lines the NPCs say. Kept here so you can edit them in one place.
QUOTES = [
    "لو الكود اشتغل من أول مرة، يبقى فيه حاجة غلط أكيد.",
    "It works on my machine. مش مشكلتي بقى.",
    "أنا مش بعمل Debug، أنا بتفاوض مع الكود.",
    "الـ Assembly مش صعبة، إنت بس مش فاهم حاجة خالص.",
    "سطرين كود و ٤ ساعات بندور على الفاصلة المنقوطة.",
    "الـ Segmentation Fault ده صاحبي من سنة تانية.",
    "مفيش حاجة اسمها bug، دي feature مش متوثقة.",
    "Ctrl+C, Ctrl+V — أقوى Design Pattern في الكلية.",
    "الديدلاين النهاردة؟ يبقى هنبدأ النهاردة.",
    "أنا مخلص المشروع… في دماغي.",
    "كل مشكلة ليها حل على Stack Overflow، غير مشكلتي.",
    "الـ Git merge conflict ده هيخلص صداقات.",
    "بقولك إيه، خلينا نعمل Restart للراوتر الأول.",
    "أنا مش تعبان، أنا بس compile بقاله ساعتين.",
    "الشيت ده اتحل امبارح… بس مش عارف مين حله.",
    "أول مرة أشوف الكود بتاعي وأقول: مين اللي كتب ده؟ وأكتشف إني أنا.",
    "المحاضرة الساعة ٨؟ دي شائعة.",
    "أنا هنام بدري النهاردة. — كل يوم، الساعة ٣ الفجر.",
    "لو الـ WiFi وقع، البروجكت وقع معاه.",
    "خدت الكورس ده عشان الاسم كان حلو.",
    "بنعمل Documentation؟ إحنا لسه مخلصناش Code.",
    "الـ Hardware بيكرهني شخصياً.",
    "اللحام في المعمل فن، وأنا فنان فاشل.",
    "شحنت اللاب قبل الامتحان؟ لا. طبعاً لا.",
    "قهوتين ومحاضرة، ده الروتين.",
    "الـ Recursion؟ شوف الـ Recursion.",
    "حفظت الـ Slides، مفهمتش حاجة، جبت امتياز.",
    "الكويز الفجائي ده مش فجائي، إحنا بس مش بنذاكر.",
    "الـ GPA رقم، والرقم نسبي، والنسبية نظرية.",
    "مبنى G متاهة، وأنا المينوتور.",
    "لقيت المعمل بعد ٣ سنين. الحمد لله.",
    "التراب الجاي ده أنا هبقى منظم فيه. — قالها ٨ ترمات.",
    "الفلاشة دي فيها كل حاجة. بس هي فين؟",
    "بنحل الشيت جماعي عشان الغلط يبقى جماعي.",
    "لو مشروع التخرج سهل، يبقى إنت غيرت الموضوع.",
    "الـ Deploy على السيرفر: نص ساعة. الشرح للدكتور: ٣ شهور.",
    "أنا بحب البرمجة، البرمجة هي اللي مش بتحبني.",
    "print('here') — أقوى أداة Debugging اخترعها الإنسان.",
    "الـ Presentation بكرة، والسلايدز لسه فاضية. عادي.",
    "بنقول للدكتور خلصنا، وبنروح نخلص.",
    "الكافيتريا هي المعمل الحقيقي.",
    "بنقعد في Teues عشان الجو، مش عشان نذاكر.",
    "الـ Deadline بيتمد دايماً… إلا المرة دي.",
    "كل سنة بقول هغير تخصص، وكل سنة بفضل.",
    "شغال على الـ Bug ده من امبارح، طلع اسم المتغير غلط.",
    "الـ StackOverflow هو الدكتور الحقيقي بتاعي.",
    "أنا مش بنام قليل، أنا بعمل Power Saving Mode.",
    "الترم ده سهل. — الجملة اللي بتجيب النحس.",
    "مفيش حاجة بتشتغل، وبرضه الحمد لله.",
    "بنتخرج إزاي بقى؟ سؤال وجيه.",
    "الـ Compiler بيكلمني بلغة مش بفهمها، وأنا برد عليه بأمل.",
    "أهم Skill اتعلمتها: إني أهز راسي وأنا مش فاهم.",
    "ذاكرنا ليلة الامتحان، ومشينا على بركة الله.",
    "الـ Team Project: واحد بيشتغل، والباقي بيشجع.",
    "أنا الواحد اللي بيشتغل. — كل حد في الجروب",
    "حياتي كلها Try / Catch.",
    "بعد ٥ سنين، لسه بقول الـ Pointer ده رايح فين.",
    "أجمل صوت في الدنيا: Build Successful.",
    "أوحش صوت في الدنيا: الدكتور بيقول «تعالى اشرح».",
    "خمس سنين عدت زي الـ while loop، من غير break.",
    "لو رجع بيا الزمن، هختار نفس الكلية. وهندم تاني.",
    "يوم التخرج ده الـ return statement بتاعنا.",
    "الدفعة دي أحسن Exception حصلت في حياتي.",
    "كل واحد فينا كان Thread، والنهاردة بنعمل join.",
]

NICKNAME_HINTS = {}  # optional manual overrides: {"Full Name": "Nickname"}


def slugify(name: str) -> str:
    """ASCII-safe file stem. Arabic names fall back to a short hash."""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = decomposed.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only).strip("-").lower()
    slug = re.sub(r"-{2,}", "-", slug)
    if not slug:
        slug = "student-" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
    return slug[:48]


def clean_name(stem: str) -> str:
    """Turn a photo file name into something printable."""
    name = stem.replace("_", " ").replace("-", " ")
    name = NOISE.sub(" ", name)
    name = TRAILING_JUNK.sub("", name)
    name = MULTISPACE.sub(" ", name).strip()
    if not name:
        return "Unnamed Engineer"
    # Only title-case pure-ASCII names; Arabic has no case.
    if name.isascii():
        name = " ".join(w if w.isupper() and len(w) <= 3 else w.capitalize()
                        for w in name.split())
    return name


def stable_index(key: str, modulo: int) -> int:
    digest = hashlib.sha1(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % modulo


def assign_stages(count: int) -> list[int]:
    """Spread everyone as evenly as possible over the 5 stages."""
    base, extra = divmod(count, TOTAL_STAGES)
    stages: list[int] = []
    for stage in range(1, TOTAL_STAGES + 1):
        n = base + (1 if stage <= extra else 0)
        stages.extend([stage] * n)
    return stages


def load_existing() -> dict[str, dict]:
    if not STUDENTS_JSON.exists():
        return {}
    try:
        data = json.loads(STUDENTS_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  ! could not reuse existing students.json ({exc})", file=sys.stderr)
        return {}
    records = data.get("students", data if isinstance(data, list) else [])
    return {r["full_name"].strip().lower(): r for r in records if r.get("full_name")}


def build_record(idx: int, name: str, stage: int, photo: str | None,
                 previous: dict[str, dict]) -> dict:
    keep = previous.get(name.strip().lower(), {})
    return {
        "id": keep.get("id") or f"s{idx:03d}",
        "full_name": name,
        "nickname": keep.get("nickname") or NICKNAME_HINTS.get(name, ""),
        "baby_photo_url": photo or keep.get("baby_photo_url") or "",
        "stage": keep.get("stage") or stage,
        "custom_quote": keep.get("custom_quote") or QUOTES[stable_index(name, len(QUOTES))],
    }


def write_json(records: list[dict]) -> None:
    STUDENTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_by": "scripts/build_students.py",
        "count": len(records),
        "stages": TOTAL_STAGES,
        "students": records,
    }
    STUDENTS_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"  -> {STUDENTS_JSON.relative_to(ROOT)} ({len(records)} students)")


def cmd_placeholder(count: int) -> int:
    previous = load_existing()
    stages = assign_stages(count)
    records = [
        build_record(i + 1, f"Engineer {i + 1:03d}", stages[i], "", previous)
        for i in range(count)
    ]
    write_json(records)
    print("  placeholder roster ready — run --import once the photos are downloaded")
    return 0


def cmd_import(folder: Path) -> int:
    try:
        from PIL import Image, ImageOps
    except ImportError:
        print("Pillow is required:  pip install Pillow pillow-heif", file=sys.stderr)
        return 1

    try:
        import pillow_heif  # noqa: F401

        pillow_heif.register_heif_opener()
    except ImportError:
        print("  note: pillow-heif not installed — .HEIC files will be skipped")

    if not folder.is_dir():
        print(f"No such folder: {folder}", file=sys.stderr)
        return 1

    files = sorted(
        (p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES),
        key=lambda p: p.name.lower(),
    )
    if not files:
        print(f"No images found in {folder}", file=sys.stderr)
        return 1

    print(f"  found {len(files)} images in {folder}")
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    previous = load_existing()
    stages = assign_stages(len(files))

    records: list[dict] = []
    used_slugs: set[str] = set()
    skipped = 0

    for idx, path in enumerate(files):
        name = clean_name(path.stem)
        slug = slugify(name)
        unique = slug
        bump = 2
        while unique in used_slugs:
            unique = f"{slug}-{bump}"
            bump += 1
        used_slugs.add(unique)

        out = PHOTO_DIR / f"{unique}.webp"
        try:
            with Image.open(path) as img:
                img = ImageOps.exif_transpose(img).convert("RGB")
                square = ImageOps.fit(
                    img, (PHOTO_SIZE, PHOTO_SIZE), method=Image.LANCZOS, centering=(0.5, 0.4)
                )
                square.save(out, "WEBP", quality=WEBP_QUALITY, method=6)
        except Exception as exc:  # noqa: BLE001 - one bad photo must not stop the batch
            print(f"  ! skipped {path.name}: {exc}", file=sys.stderr)
            skipped += 1
            continue

        records.append(
            build_record(len(records) + 1, name, stages[idx], f"students/{unique}.webp", previous)
        )

    if not records:
        print("Every image failed to convert — nothing written.", file=sys.stderr)
        return 1

    # Stages were sized for the full file list; redo them for what survived.
    for record, stage in zip(records, assign_stages(len(records))):
        key = record["full_name"].strip().lower()
        record["stage"] = previous.get(key, {}).get("stage") or stage

    write_json(records)
    print(f"  -> {PHOTO_DIR.relative_to(ROOT)}/ ({len(records)} webp files, {skipped} skipped)")
    print("  open src/data/students.json to add nicknames and personal quotes")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--import", dest="import_dir", metavar="FOLDER",
                       help="folder of baby photos to convert into game data")
    group.add_argument("--placeholder", type=int, metavar="N",
                       help="write a roster of N placeholder students")
    args = parser.parse_args()

    if args.import_dir:
        return cmd_import(Path(args.import_dir).expanduser())
    if args.placeholder < 1:
        print("--placeholder needs a positive number", file=sys.stderr)
        return 1
    return cmd_placeholder(args.placeholder)


if __name__ == "__main__":
    raise SystemExit(main())
