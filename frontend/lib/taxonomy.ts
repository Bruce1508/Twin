export type ErrorCategory =
  | "grammaire"
  | "lexique"
  | "orthographe"
  | "syntaxe"
  | "registre"
  | "comprehension";

export interface TaxonomyEntry {
  tag: string;
  category: ErrorCategory;
  gloss: string;
  example: string;
  wholeTextOnly?: boolean; // true = whole-text observation only, never a span error
  readingOnly?: boolean; // true = only valid for reading exercises, never routed to writing drills
  speakingOnly?: boolean; // true = only valid for speaking exercises, never routed to writing drills
}

export const TAXONOMY: readonly TaxonomyEntry[] = [
  // ── GRAMMAIRE ──────────────────────────────────────────────────────────────
  {
    tag: "subjonctif_apres_conjonction",
    category: "grammaire",
    gloss: "Subjonctif manquant ou mal formé après une conjonction qui l'exige (bien que, pour que, avant que…)",
    example: "Il faut que tu *viens* → viennes",
  },
  {
    tag: "subjonctif_apres_verbe_volonte",
    category: "grammaire",
    gloss: "Subjonctif manquant après un verbe de volonté, souhait ou doute (vouloir, souhaiter, douter…)",
    example: "Je veux que tu *viens* → viennes",
  },
  {
    tag: "accord_participe_passe",
    category: "grammaire",
    gloss: "Accord incorrect du participe passé (avec avoir + COD antéposé, ou avec être)",
    example: "Les lettres qu'il a *écrit* → écrites",
  },
  {
    tag: "accord_adjectif",
    category: "grammaire",
    gloss: "Accord en genre/nombre incorrect entre l'adjectif et le nom",
    example: "une décision *final* → finale",
  },
  {
    tag: "accord_sujet_verbe",
    category: "grammaire",
    gloss: "Désaccord entre le sujet et la forme verbale conjuguée",
    example: "Les résultats *montre* → montrent",
  },
  {
    tag: "temps_verbal_incorrect",
    category: "grammaire",
    gloss: "Temps verbal inapproprié au contexte (ex. présent à la place du conditionnel passé)",
    example: "Si j'avais su, je *viens* → serais venu",
  },
  {
    tag: "conditionnel_present",
    category: "grammaire",
    gloss: "Conditionnel présent mal formé ou absent dans une hypothèse au présent/futur",
    example: "Si tu étudiais, tu *réussis* → réussirais",
  },
  {
    tag: "conditionnel_passe",
    category: "grammaire",
    gloss: "Conditionnel passé absent ou mal formé dans une hypothèse irréelle au passé",
    example: "Si j'avais su, je *venais* → serais venu",
  },
  {
    tag: "article_manquant_ou_superflu",
    category: "grammaire",
    gloss: "Article défini, indéfini ou partitif manquant ou employé à tort",
    example: "*Le* courage est nécessaire (correct) vs *un* eau → de l'eau",
  },
  {
    tag: "preposition_incorrecte",
    category: "grammaire",
    gloss: "Préposition absente, superflue, ou remplacée par la mauvaise",
    example: "compter *pour* faire → pour faire",
  },
  {
    tag: "negation_incomplete",
    category: "grammaire",
    gloss: "Construction négative incomplète ou mal placée (ne … pas, ne … jamais…)",
    example: "Je *ne* comprends → ne comprends pas",
  },
  {
    tag: "pronom_relatif_incorrect",
    category: "grammaire",
    gloss: "Mauvais choix de pronom relatif (qui/que/dont/où/lequel…)",
    example: "l'endroit *que* je vais → où je vais",
  },
  {
    tag: "pronom_objet_incorrect",
    category: "grammaire",
    gloss: "Pronom COD/COI mal choisi ou mal placé",
    example: "je *lui* vois tous les jours → le/la vois",
  },
  {
    tag: "genre_nom_incorrect",
    category: "grammaire",
    gloss: "Genre grammatical du nom incorrect (un/une, le/la)",
    example: "*la* problème → le problème",
  },
  {
    tag: "pluriel_irregulier_incorrect",
    category: "grammaire",
    gloss: "Pluriel d'un nom ou adjectif irrégulier formé incorrectement",
    example: "*travails* → travaux",
  },

  // ── SYNTAXE ────────────────────────────────────────────────────────────────
  {
    tag: "ordre_mots_incorrect",
    category: "syntaxe",
    gloss: "Ordre des constituants incorrect (calque de l'anglais ou autre langue)",
    example: "*Je souvent mange* → Je mange souvent",
  },
  {
    tag: "phrase_incomplete",
    category: "syntaxe",
    gloss: "Phrase sans verbe principal ou sans sujet exprimé là où il le faut",
    example: "*Étant donné les circonstances.* (fragment sans principale)",
  },
  {
    tag: "subordination_incorrecte",
    category: "syntaxe",
    gloss: "Proposition subordonnée mal introduite ou mal construite",
    example: "*Bien que il fait froid* → bien qu'il fasse froid",
  },
  {
    tag: "infinitif_vs_subordonnee",
    category: "syntaxe",
    gloss: "Infinitif utilisé là où une subordonnée est requise, ou vice versa (sujets différents)",
    example: "Je veux *qu'il partir* → qu'il parte",
  },
  {
    tag: "connecteur_logique_absent",
    category: "syntaxe",
    gloss: "Absence de connecteurs logiques rendant les liens entre phrases opaques",
    example: "(whole-text: idées juxtaposées sans pourtant / néanmoins / en revanche…)",
    wholeTextOnly: true,
  },
  {
    tag: "repetition_connecteur_basique",
    category: "syntaxe",
    gloss: "Sur-utilisation de et/mais/donc au détriment de connecteurs plus variés",
    example: "(whole-text: 6 phrases commençant par 'et')",
    wholeTextOnly: true,
  },
  {
    tag: "ponctuation_incorrecte",
    category: "syntaxe",
    gloss: "Virgule manquante ou superflue, point mal placé, mauvais usage du point-virgule",
    example: "*Cependant il reste des problèmes* → Cependant, il reste…",
  },

  // ── LEXIQUE ────────────────────────────────────────────────────────────────
  {
    tag: "faux_ami",
    category: "lexique",
    gloss: "Emploi d'un faux ami avec l'anglais (ou autre L1) au sens incorrect",
    example: "*actuellement* au sens de 'actually' → en fait / en réalité",
  },
  {
    tag: "calque_lexical",
    category: "lexique",
    gloss: "Traduction mot à mot d'une expression idiomatique d'une autre langue",
    example: "*faire sens* (calque de 'make sense') → avoir du sens",
  },
  {
    tag: "terme_imprecis",
    category: "lexique",
    gloss: "Terme trop vague ou générique là où un terme précis est attendu en B2",
    example: "*une chose importante* → un enjeu majeur / un élément crucial",
  },
  {
    tag: "collocation_incorrecte",
    category: "lexique",
    gloss: "Association nom+verbe ou adj+nom non idiomatique en français",
    example: "*commettre une faute grande* → commettre une grave faute",
  },
  {
    tag: "confusion_paronymes",
    category: "lexique",
    gloss: "Confusion entre deux mots de forme proche (paronymes)",
    example: "*compléter* vs *complémenter*, *émerger* vs *immerger*",
  },
  {
    tag: "repetition_lexicale",
    category: "lexique",
    gloss: "Répétition du même mot/expression dans un court passage sans effet stylistique voulu",
    example: "(whole-text: 'important' répété 5 fois dans le texte)",
    wholeTextOnly: true,
  },
  {
    tag: "niveau_vocabulaire_insuffisant",
    category: "lexique",
    gloss: "Vocabulaire systématiquement trop élémentaire pour le niveau B2 visé",
    example: "(whole-text: recours exclusif à des mots A1/A2)",
    wholeTextOnly: true,
  },

  // ── ORTHOGRAPHE ────────────────────────────────────────────────────────────
  {
    tag: "accent_manquant_ou_incorrect",
    category: "orthographe",
    gloss: "Accent absent, incorrect ou superflu sur une voyelle",
    example: "*etudier* → étudier, *ou* (pronom) → où",
  },
  {
    tag: "accord_orthographique",
    category: "orthographe",
    gloss: "Marque d'accord (s, x, e) manquante ou incorrecte à l'écrit",
    example: "*des résultat* → des résultats",
  },
  {
    tag: "homophone_incorrect",
    category: "orthographe",
    gloss: "Confusion entre homophones (a/à, ou/où, son/sont, ce/se…)",
    example: "*il a Paris* → il est *à* Paris",
  },
  {
    tag: "cedille_trema_absent",
    category: "orthographe",
    gloss: "Cédille (ç) ou tréma (ë, ï) manquant",
    example: "*francais* → français, *noel* → Noël",
  },
  {
    tag: "majuscule_incorrecte",
    category: "orthographe",
    gloss: "Majuscule manquante (début de phrase, noms propres) ou superflue",
    example: "*la france* → la France",
  },
  {
    tag: "trait_union_incorrect",
    category: "orthographe",
    gloss: "Trait d'union manquant ou superflu (inversion sujet-verbe, mots composés)",
    example: "*vas tu* → vas-tu",
  },

  // ── REGISTRE ───────────────────────────────────────────────────────────────
  {
    tag: "registre_trop_familier",
    category: "registre",
    gloss: "Registre familier ou oral dans un contexte formel (argumentation, lettre officielle)",
    example: "*c'est trop cool* dans un texte argumentatif → c'est très positif",
  },
  {
    tag: "registre_trop_soutenu",
    category: "registre",
    gloss: "Registre excessivement formel ou archaïque dans un contexte neutre/conversationnel",
    example: "*Permettez que je vous soumette humblement* dans un email informel",
  },
  {
    tag: "registre_incoherence",
    category: "registre",
    gloss: "Mélange de registres dans un même texte (formel et familier entremêlés)",
    example: "(whole-text: une lettre formelle avec des expressions orales)",
    wholeTextOnly: true,
  },

  // ── COMPRÉHENSION (reading-only — never routed to writing drills) ─────────
  {
    tag: "inference_manquee",
    category: "comprehension",
    gloss: "L'apprenant n'a pas déduit un sens implicite non dit directement dans le texte",
    example: "Question sur l'implication d'une phrase → réponse hors sujet ou trop littérale",
    readingOnly: true,
  },
  {
    tag: "reformulation_incorrecte",
    category: "comprehension",
    gloss: "L'apprenant n'a pas reconnu qu'une expression du texte était reformulée dans la question",
    example: "'tissu social fragilisé' reformulé → non reconnu",
    readingOnly: true,
  },
  {
    tag: "hors_texte",
    category: "comprehension",
    gloss: "La réponse introduit des informations extérieures au texte ou invente des détails",
    example: "Réponse basée sur connaissances générales, pas sur le texte",
    readingOnly: true,
  },
  {
    tag: "information_manquante",
    category: "comprehension",
    gloss: "Un fait explicitement présent dans le texte n'a pas été repéré ou cité",
    example: "Le texte mentionne trois raisons → l'apprenant n'en cite que deux",
    readingOnly: true,
  },
  {
    tag: "opinion_auteur_mal_identifiee",
    category: "comprehension",
    gloss: "L'attitude ou le point de vue de l'auteur a été mal interprété",
    example: "Auteur ironique → apprenant l'interprète comme sincèrement positif",
    readingOnly: true,
  },
  {
    tag: "interpretation_globale_incorrecte",
    category: "comprehension",
    gloss: "L'idée principale ou l'intention générale du texte a été mal comprise",
    example: "Texte argumentatif → apprenant croit que c'est descriptif",
    readingOnly: true,
  },

  // ── PRODUCTION ORALE (speaking-only — never routed to writing drills) ───────
  {
    tag: "hesitation_excessive",
    category: "syntaxe",
    gloss: "Pauses, faux départs ou répétitions qui fragmentent le discours de façon non idiomatique",
    example: "Je veux… je veux dire… euh… c'est que…",
    speakingOnly: true,
  },
  {
    tag: "coherence_discursive",
    category: "syntaxe",
    gloss: "Enchaînement logique absent entre les idées dans le monologue",
    example: "(whole-discourse: idées juxtaposées sans marqueurs d'organisation)",
    speakingOnly: true,
    wholeTextOnly: true,
  },
  {
    tag: "debit_syntaxique",
    category: "syntaxe",
    gloss: "Structures syntaxiques tronquées ou non finalisées typiques du débit oral spontané",
    example: "Si on regarde les… enfin, ça dépend du contexte",
    speakingOnly: true,
  },
  {
    tag: "approximation_lexicale",
    category: "lexique",
    gloss: "Terme approximatif ou périphrase utilisé faute du mot précis à l'oral",
    example: "*le truc pour mesurer* → le thermomètre",
    speakingOnly: true,
  },
  {
    tag: "calque_phonologique",
    category: "lexique",
    gloss: "Mot étranger prononcé ou orthographié à la française révélant une lacune lexicale",
    example: "*le meeting* → la réunion",
    speakingOnly: true,
  },
  {
    tag: "registre_oral_inadapte",
    category: "registre",
    gloss: "Registre familier systématique dans un contexte de production formelle simulée",
    example: "*ouais, genre, truc* dans un monologue de présentation formelle",
    speakingOnly: true,
    wholeTextOnly: true,
  },
  {
    tag: "comprehension_consigne_partielle",
    category: "comprehension",
    gloss: "Le monologue ne répond que partiellement au scénario ou ignore une contrainte du prompt",
    example: "Prompt demandait de défendre une position — l'apprenant décrit sans argumenter",
    speakingOnly: true,
  },

  // ── UNCATEGORIZED (fallback — LLM uses only when no tag fits) ─────────────
  {
    tag: "uncategorized",
    category: "grammaire",
    gloss: "Erreur réelle ne correspondant à aucun tag existant — signal de lacune dans la taxonomie",
    example: "(aucun exemple — tag de repli uniquement)",
  },
] as const;

export type ErrorTag = (typeof TAXONOMY)[number]["tag"];

export const TAXONOMY_TAGS: readonly ErrorTag[] = TAXONOMY.map((e) => e.tag);

export const SPAN_TAGS: readonly ErrorTag[] = TAXONOMY.filter(
  (e) => !e.wholeTextOnly && !e.readingOnly && !e.speakingOnly
).map((e) => e.tag);

export const WHOLE_TEXT_TAGS: readonly ErrorTag[] = TAXONOMY.filter(
  (e) => e.wholeTextOnly
).map((e) => e.tag);

export const READING_TAGS: readonly ErrorTag[] = TAXONOMY.filter(
  (e) => e.readingOnly
).map((e) => e.tag);

export const SPEAKING_TAGS: readonly ErrorTag[] = TAXONOMY.filter(
  (e) => e.speakingOnly
).map((e) => e.tag);

export function getTaxonomyEntry(tag: string): TaxonomyEntry | undefined {
  return TAXONOMY.find((e) => e.tag === tag);
}

export function isValidTag(tag: string): tag is ErrorTag {
  return TAXONOMY_TAGS.includes(tag as ErrorTag);
}
