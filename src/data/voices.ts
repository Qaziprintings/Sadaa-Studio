export type PrebuiltVoiceName = "Kore" | "Charon" | "Puck" | "Fenrir" | "Zephyr";

export type TtsEngineId = "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";

export interface VoiceProfile {
  id: PrebuiltVoiceName;
  displayName: string;
  urduTitle: string;
  gender: "Female" | "Male";
  timbre: string;
  bestFor: string;
  defaultStyle: string;
  previewText: string;
}

export interface DeliveryPreset {
  id: string;
  label: string;
  urduLabel: string;
  stylePrompt: string;
  description: string;
}

export interface ScriptTemplate {
  id: string;
  title: string;
  category: string;
  mode: "single" | "dialogue";
  recommendedVoice: PrebuiltVoiceName;
  recommendedStyle: string;
  text?: string;
  dialogue?: {
    speakerA: string;
    voiceA: PrebuiltVoiceName;
    styleA: string;
    speakerB: string;
    voiceB: PrebuiltVoiceName;
    styleB: string;
    turns: Array<{ speaker: "A" | "B"; text: string }>;
  };
}

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: "Kore",
    displayName: "Kore",
    urduTitle: "مریم · متوازن اور شائستہ",
    gender: "Female",
    timbre: "Clear Alto",
    bestFor: "News, Documentary, Audiobooks",
    defaultStyle: "Clear, poised Urdu broadcast narrator with natural phrasing and crisp pronunciation",
    previewText: "آداب! صدا اسٹوڈیو میں خوش آمدید۔ آج ہم اردو زبان کے خوبصورت لہجے اور آواز کی دنیا کا سفر کریں گے۔",
  },
  {
    id: "Charon",
    displayName: "Charon",
    urduTitle: "ارسلان · گہرا اور پُروقار",
    gender: "Male",
    timbre: "Deep Baritone",
    bestFor: "Documentaries, Trailers, History",
    defaultStyle: "Deep, resonant, authoritative Urdu documentary narrator with measured cinematic pauses",
    previewText: "تاریخ کے اوراق گواہ ہیں کہ الفاظ میں اگر سچائی اور وقار ہو تو وہ صدیوں تک گونجتے رہتے ہیں۔",
  },
  {
    id: "Puck",
    displayName: "Puck",
    urduTitle: "حمزہ · پُرجوش اور رواں",
    gender: "Male",
    timbre: "Warm Tenor",
    bestFor: "Podcasts, YouTube, Storytelling",
    defaultStyle: "Warm, engaging, conversational Urdu host with friendly energy",
    previewText: "السلام علیکم دوستو! آج کی اس نشست میں ہم ایک ایسے دلچسپ موضوع پر بات کریں گے جو آپ سب کو پسند آئے گا۔",
  },
  {
    id: "Fenrir",
    displayName: "Fenrir",
    urduTitle: "تیمور · بلند اور بااثر",
    gender: "Male",
    timbre: "Crisp Command",
    bestFor: "Commercials, Promos, IVR",
    defaultStyle: "Confident, energetic Urdu commercial voice-over with crisp emphasis",
    previewText: "جدید معیار، بے مثال رفتار اور ہر لفظ میں واضح تاثر۔ اب اپنی کہانی کو نئی پہچان دیں۔",
  },
  {
    id: "Zephyr",
    displayName: "Zephyr",
    urduTitle: "ثنا · نرم اور پُرسکون",
    gender: "Female",
    timbre: "Soft Soprano",
    bestFor: "Poetry, Reflections, Explainers",
    defaultStyle: "Gentle, soothing, melodic Urdu speaker with delicate emotional warmth",
    previewText: "شام کی خاموشی میں جب کوئی خوبصورت شعر گنگنایا جائے تو دل کو ایک عجیب سا سکون ملتا ہے۔",
  },
];

export const DELIVERY_PRESETS: DeliveryPreset[] = [
  {
    id: "documentary",
    label: "Documentary",
    urduLabel: "دستاویزی",
    stylePrompt: "Calm, authoritative Urdu documentary narrator with unhurried pacing and gravitas",
    description: "Measured cadence suited for historical, cultural, and travel films.",
  },
  {
    id: "news",
    label: "News Anchor",
    urduLabel: "خبریہ",
    stylePrompt: "Crisp, formal Urdu broadcast news anchor with clear articulation and steady rhythm",
    description: "Broadcast clarity with neutral authority and precise pauses.",
  },
  {
    id: "poetry",
    label: "Poetry & Adab",
    urduLabel: "شاعری و ادب",
    stylePrompt: "Melodic, reflective Urdu literary and poetry recitation with gentle emotional cadence",
    description: "Expressive rises and lyrical pauses for ghazals, nazms, and prose.",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    urduLabel: "داستان گوئی",
    stylePrompt: "Warm, captivating Urdu storyteller with expressive phrasing and intimate tone",
    description: "Engaging narrative rhythm for fiction, podcasts, and audiobooks.",
  },
  {
    id: "commercial",
    label: "Commercial",
    urduLabel: "اشتہار",
    stylePrompt: "Upbeat, persuasive, energetic Urdu commercial voice-over",
    description: "Bright presence tailored for brand spots, promos, and trailers.",
  },
];

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "lahore-doc",
    title: "Lahore Heritage Documentary",
    category: "Documentary",
    mode: "single",
    recommendedVoice: "Charon",
    recommendedStyle: DELIVERY_PRESETS[0].stylePrompt,
    text: "لاہور محض اینٹوں اور پتھروں کا شہر نہیں، بلکہ صدیوں پر محیط تہذیب، ادب اور ثقافت کی ایک زندہ داستان ہے۔ جب صبح کی پہلی کرن بادشاہی مسجد کے گنبدوں کو چھوتی ہے، تو اس شہر کی گلیوں میں ماضی کی بازگشت سنائی دینے لگتی ہے۔",
  },
  {
    id: "morning-news",
    title: "Morning Bulletin Intro",
    category: "Broadcast News",
    mode: "single",
    recommendedVoice: "Kore",
    recommendedStyle: DELIVERY_PRESETS[1].stylePrompt,
    text: "آداب ناظرین! صبح کے نو بجے کے خبرنامے میں خوش آمدید۔ سب سے پہلے نظر ڈالتے ہیں آج کی اہم ترین خبروں پر۔ وفاقی دارالحکومت میں نئی ڈیجیٹل پالیسی کے تحت تعلیمی اداروں کے لیے جدید تحقیقی مراکز کے قیام کا اعلان کر دیا گیا ہے۔",
  },
  {
    id: "urdu-adab",
    title: "Evening Literary Reflection",
    category: "Poetry & Adab",
    mode: "single",
    recommendedVoice: "Zephyr",
    recommendedStyle: DELIVERY_PRESETS[2].stylePrompt,
    text: "وقت گزرتا رہتا ہے، موسم بدلتے رہتے ہیں، مگر کچھ یادیں بارش کی پہلی بوند کی طرح دل کی مٹی کو ہمیشہ تروتازہ رکھتی ہیں۔ اردو ادب کی یہی خوبی ہے کہ یہ خاموش جذبات کو بھی لفظوں کا لباس پہنا دیتی ہے۔",
  },
  {
    id: "tech-promo",
    title: "Product Launch Promo",
    category: "Commercial",
    mode: "single",
    recommendedVoice: "Fenrir",
    recommendedStyle: DELIVERY_PRESETS[4].stylePrompt,
    text: "اب اپنے خیالات کو آواز دیں! چاہے یوٹیوب ویڈیو ہو، دستاویزی فلم یا کوئی کاروباری اشتہار، اب خالص اور قدرتی اردو وائس اوور صرف ایک کلک کی دوری پر ہے۔",
  },
  {
    id: "podcast-dialogue",
    title: "Urdu Podcast Conversation",
    category: "Dual Dialogue",
    mode: "dialogue",
    recommendedVoice: "Puck",
    recommendedStyle: DELIVERY_PRESETS[3].stylePrompt,
    dialogue: {
      speakerA: "Bilal",
      voiceA: "Puck",
      styleA: "Warm, curious Urdu podcast host with lively conversational pacing",
      speakerB: "Ayesha",
      voiceB: "Kore",
      styleB: "Thoughtful, articulate Urdu guest speaker with clear, friendly tone",
      turns: [
        {
          speaker: "A",
          text: "آداب سامعین! <breath> آج کے پوڈکاسٹ میں ہمارے ساتھ موجود ہیں عائشہ صاحبہ، جن سے ہم اردو آڈیو کہانیوں کے بڑھتے ہوئے رجحان پر بات کریں گے۔",
        },
        {
          speaker: "B",
          text: "بہت شکریہ بلال! |yeah| واقعی پچھلے دو برسوں میں لوگ پڑھنے کے ساتھ ساتھ معیاری اردو پوڈکاسٹس اور آڈیو بکس سننا بہت پسند کر رہے ہیں۔",
        },
        {
          speaker: "A",
          text: "بالکل درست، اور خاص طور پر جب تلفظ صاف ہو اور اندازِ بیاں قدرتی لگے تو سننے والا آخر تک جڑا رہتا ہے۔",
        },
      ],
    },
  },
];
