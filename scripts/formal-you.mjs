// Detects FORMAL second-person address ("вы" / "usted") in machine translations.
//
// The vibeling /translate API translates each line in isolation, with no idea who
// is talking to whom — so it defaults to the polite form and turns film dialogue
// into HR-speak ("Если вы не знаете, кто я..." for one guy threatening another).
// Nearly every scene we cut is two people talking informally, so the default is
// almost always wrong.
//
// A regex can't conjugate, so this doesn't rewrite anything — it FLAGS the lines
// so the model fixes them in the same pass that fixes misheard proper nouns
// (see the "ты, not вы" rule in the social-video skill).

/** Standalone «вы» and its case forms + «ваш…» (not «выход», «выше», …). */
const RU_PRONOUNS =
  /(^|[^а-яёА-ЯЁ])(вы|вас|вам|вами|ваш(?:а|е|и|у|ю|ем|ей|его|ему|им|их|ими|ими|ого|ой|ую|ые|ым|ых)?)(?![а-яёА-ЯЁ])/gi;

/** Common 2nd-person-plural verb/imperative forms that read formal even with no
    pronoun in the line ("Знаете, что...", "Подождите"). Hand-picked from actual
    dialogue rather than derived — a morphological guess would over-flag. */
const RU_VERBS =
  /(^|[^а-яёА-ЯЁ])(знаете|думаете|хотите|можете|видите|смотрите|слышите|делаете|говорите|понимаете|помните|идёте|идете|скажите|послушайте|подождите|извините|простите|посмотрите|перестаньте|успокойтесь|садитесь|возьмите|дайте|представляете)(?![а-яёА-ЯЁ])/gi;

/** Plural/polite imperatives — «действуйте», «поставьте». Any «…йте»/«…ьте» word
    is one, EXCEPT a locative noun after a preposition ("на сайте", "в чате"), so
    those are filtered out in code below rather than in the pattern. */
const RU_IMPERATIVE = /(^|[^а-яёА-ЯЁ])([а-яёА-ЯЁ]{3,}(?:йте|ьте))(?![а-яёА-ЯЁ])/gi;
const LOCATIVE_PREPS = new Set(["в", "во", "на", "о", "об", "обо", "при", "по"]);

/** Spanish formal address. «su/sus» is ambiguous (his/her/their), so only the
    unambiguous markers are flagged. */
const ES_FORMAL = /(^|[^a-záéíóúñA-ZÁÉÍÓÚÑ])(usted|ustedes)(?![a-záéíóúñA-ZÁÉÍÓÚÑ])/gi;

const PATTERNS = { ru: [RU_PRONOUNS, RU_VERBS], es: [ES_FORMAL] };

/** Words in `text` that indicate formal address, or [] if none. */
export const formalHits = (text, lang) => {
  const hits = [];
  for (const re of PATTERNS[lang] ?? []) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) hits.push(m[2]);
  }
  if (lang === "ru") {
    RU_IMPERATIVE.lastIndex = 0;
    for (const m of text.matchAll(RU_IMPERATIVE)) {
      const before = text.slice(0, m.index + m[1].length).trim().split(/\s+/).pop() ?? "";
      if (!LOCATIVE_PREPS.has(before.toLowerCase())) hits.push(m[2]);
    }
  }
  return hits;
};

/**
 * Print a review list for every flagged line. `items` is [{ label, text }].
 * Returns the number flagged (0 = nothing to review).
 */
export const reportFormal = (items, lang) => {
  const flagged = items
    .map((it) => ({ ...it, hits: formalHits(it.text, lang) }))
    .filter((it) => it.hits.length);
  if (!flagged.length) return 0;
  console.warn(
    `\n  ⚠ ${flagged.length} ${lang} line(s) use the FORMAL form — rewrite to the informal ` +
      `«ты»/«tú» (verbs too) unless the speaker really addresses several people or a superior:`,
  );
  for (const f of flagged) console.warn(`     [${f.label}] ${f.text}   ← ${[...new Set(f.hits)].join(", ")}`);
  return flagged.length;
};
