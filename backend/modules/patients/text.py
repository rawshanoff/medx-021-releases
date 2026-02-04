import re

_LATIN_RE = re.compile(r"[A-Za-z]")
_CYR_RE = re.compile(r"[А-Яа-яЁёҚқҒғЎўҲҳІі]")


def contains_latin(text: str) -> bool:
    return bool(_LATIN_RE.search(text or ""))


def contains_cyrillic(text: str) -> bool:
    return bool(_CYR_RE.search(text or ""))


def latin_to_cyrillic(text: str) -> str:
    """
    Minimal Uzbek/RU-friendly transliteration for search use.
    Goal: make 'Rahmonov' match 'Рахмонов', etc.
    """
    if not text:
        return text

    t = text.strip().lower()

    # digraphs / apostrophes first
    t = (
        t.replace("o‘", "ў")
        .replace("o’", "ў")
        .replace("o'", "ў")
        .replace("g‘", "ғ")
        .replace("g’", "ғ")
        .replace("g'", "ғ")
    )

    # common digraphs
    for a, b in [
        ("sh", "ш"),
        ("ch", "ч"),
        ("ya", "я"),
        ("yo", "ё"),
        ("yu", "ю"),
        ("ts", "ц"),
        ("kh", "х"),
        ("ye", "е"),
    ]:
        t = t.replace(a, b)

    m = {
        "a": "а",
        "b": "б",
        "d": "д",
        "e": "е",
        "f": "ф",
        "g": "г",
        "h": "х",
        "i": "и",
        "j": "ж",
        "k": "к",
        "l": "л",
        "m": "м",
        "n": "н",
        "o": "о",
        "p": "п",
        "q": "қ",
        "r": "р",
        "s": "с",
        "t": "т",
        "u": "у",
        "v": "в",
        "x": "х",
        "y": "й",
        "z": "з",
        "’": "’",
        "'": "'",
        "-": "-",
        " ": " ",
        ".": ".",
    }
    return "".join(m.get(ch, ch) for ch in t)


def cyrillic_to_latin(text: str) -> str:
    if not text:
        return text
    t = text.strip().lower()
    m = {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "yo",
        "ж": "j",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sh",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
        "қ": "q",
        "ғ": "g'",
        "ў": "o'",
        "ҳ": "h",
        "-": "-",
        " ": " ",
        ".": ".",
    }
    return "".join(m.get(ch, ch) for ch in t)


def normalize_full_name(value: str) -> str:
    """
    Normalize case for DB: 'рАхМоНоВ' -> 'Рахмонов'
    Works for Cyrillic/Latin; preserves separators.
    """
    if value is None:
        return value
    value = re.sub(r"\s+", " ", str(value)).strip()
    if not value:
        return value

    # Normalize various apostrophe characters to a single ASCII apostrophe.
    # This prevents inconsistent casing and helps avoid duplicates in lookups.
    value = (
        value.replace("’", "'")
        .replace("‘", "'")
        .replace("`", "'")
        .replace("ʼ", "'")  # U+02BC
        .replace("ʻ", "'")  # U+02BB
        .replace("‛", "'")
    )

    def _cap(seg: str) -> str:
        if not seg:
            return seg
        lower = seg.lower()
        return lower[0].upper() + lower[1:]

    out_words: list[str] = []
    for word in value.split(" "):
        parts = re.split(r"([-'])", word)
        rebuilt = []
        for i, p in enumerate(parts):
            if p in ("-", "'"):
                rebuilt.append(p)
            else:
                # After apostrophe: keep segment lower (Ulug'bek, Rahmon'ov)
                prev = parts[i - 1] if i > 0 else ""
                if prev == "'":
                    rebuilt.append(p.lower())
                else:
                    rebuilt.append(_cap(p))
        out_words.append("".join(rebuilt))
    return " ".join(out_words)
