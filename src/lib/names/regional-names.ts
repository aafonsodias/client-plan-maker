/**
 * Region-aware name generator for demo rosters and landing mockups.
 *
 * Honest framing
 * --------------
 * Each region is a *probability distribution over sub-pools* — not a single
 * monolithic list. So "north_america" is not 100% Anglo and "brazil" is not
 * 100% Luso: they reflect the actual diversity of who lives there. Surnames
 * are paired with first names from the SAME sub-pool to avoid implausible
 * mixes (e.g. "Wei Schmidt"). Pools are common, recognizable names — never
 * stereotypes, slurs or jokes.
 *
 * The generator is pure + deterministic (FNV-1a → mulberry32) so the same
 * `seed` always returns the same roster. This pairs cleanly with
 * `pickDemoAvatar` which also hashes by full name.
 */

export type Region =
  | "iberia"
  | "western_europe"
  | "eastern_europe"
  | "north_america"
  | "latam"
  | "brazil"
  | "maghreb"
  | "sub_saharan_africa"
  | "middle_east"
  | "south_asia"
  | "east_asia"
  | "southeast_asia"
  | "global";

export type Sex = "f" | "m";

export type NameRecord = {
  first: string;
  last: string;
  full: string;
  sex: Sex;
  /** The sub-pool this name was drawn from (debug/observability). */
  subPool: string;
};

// ─── Sub-pools ────────────────────────────────────────────────────────────
// Compact (10–15 entries each) but recognizable. Surnames stay within pool.

type SubPool = {
  first_f: string[];
  first_m: string[];
  last: string[];
};

const POOLS: Record<string, SubPool> = {
  iberian: {
    first_f: ["Maria", "Sofia", "Inês", "Beatriz", "Catarina", "Mariana", "Joana", "Rita", "Margarida", "Carolina"],
    first_m: ["João", "Pedro", "Miguel", "André", "Tiago", "Rui", "Hugo", "Diogo", "Bruno", "Gonçalo"],
    last: ["Silva", "Santos", "Costa", "Pereira", "Ferreira", "Almeida", "Oliveira", "Carvalho", "Sousa", "Ribeiro"],
  },
  latin_european: {
    first_f: ["Giulia", "Sofia", "Chiara", "Martina", "Camille", "Léa", "Emma", "Lucia", "Elena", "Aurora"],
    first_m: ["Marco", "Luca", "Matteo", "Lorenzo", "Antoine", "Hugo", "Mateo", "Andrea", "Davide", "Alessandro"],
    last: ["Rossi", "Romano", "Bianchi", "Ferrari", "Dubois", "Martin", "Garcia", "Conti", "Moretti", "Gallo"],
  },
  global_anglo: {
    first_f: ["Sarah", "Emily", "Jessica", "Hannah", "Olivia", "Grace", "Chloe", "Lauren", "Megan", "Amy"],
    first_m: ["John", "James", "Michael", "David", "Daniel", "Andrew", "Matthew", "Ryan", "Thomas", "Mark"],
    last: ["Smith", "Johnson", "Brown", "Taylor", "Wilson", "Davies", "Evans", "Walker", "Hall", "Wright"],
  },
  western_european: {
    first_f: ["Anna", "Sophie", "Lena", "Marie", "Laura", "Julia", "Lisa", "Sara", "Eva", "Nina"],
    first_m: ["Lukas", "Jonas", "Felix", "Niels", "Max", "Tim", "Jan", "Erik", "Sven", "Pieter"],
    last: ["Müller", "Schmidt", "Bakker", "de Vries", "Jansen", "Hansen", "Andersen", "Nielsen", "Schneider", "Fischer"],
  },
  slavic: {
    first_f: ["Anna", "Kateřina", "Magdalena", "Olga", "Natalia", "Zofia", "Hanna", "Milena", "Aleksandra", "Ivana"],
    first_m: ["Jakub", "Tomáš", "Piotr", "Andrei", "Marek", "Pavel", "Mikhail", "Jan", "Dmitri", "Viktor"],
    last: ["Nowak", "Kowalski", "Novák", "Horák", "Ivanov", "Petrov", "Sokolov", "Dvořák", "Kovács", "Popescu"],
  },
  germanic: {
    first_f: ["Anna", "Lena", "Greta", "Hanna", "Marie", "Astrid", "Ingrid", "Sigrid", "Erika", "Helga"],
    first_m: ["Johann", "Klaus", "Hans", "Otto", "Wolfgang", "Stefan", "Werner", "Lars", "Henrik", "Dieter"],
    last: ["Schmidt", "Müller", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch", "Bauer", "Richter", "Weber"],
  },
  hispanic: {
    first_f: ["María", "Sofía", "Valentina", "Camila", "Lucía", "Daniela", "Isabella", "Carolina", "Gabriela", "Andrea"],
    first_m: ["Juan", "Carlos", "José", "Diego", "Luis", "Miguel", "Andrés", "Alejandro", "Sebastián", "Mateo"],
    last: ["García", "Rodríguez", "Martínez", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores"],
  },
  indigenous_mestizo: {
    first_f: ["Yolotzin", "Itzel", "Xiomara", "Ayelén", "Quetzal", "Citlali", "Nayeli", "Suyana", "Inti", "Anahí"],
    first_m: ["Cuauhtémoc", "Tupac", "Inti", "Manco", "Tonatiuh", "Yatzil", "Camilo", "Mateo", "Felipe", "Joaquín"],
    last: ["Quispe", "Mamani", "Huamán", "Chávez", "Tlatelpa", "Xochitl", "Aymara", "Condori", "Pachacutec", "Yupanqui"],
  },
  global_catholic: {
    first_f: ["María", "Ana", "Teresa", "Lucía", "Carmen", "Esperanza", "Pilar", "Rosa", "Gabriela", "Mercedes"],
    first_m: ["José", "Francisco", "Antonio", "Manuel", "Pablo", "Pedro", "Miguel", "Daniel", "Cristián", "Rafael"],
    last: ["Cruz", "Reyes", "Salazar", "Vargas", "Mendoza", "Castillo", "Herrera", "Aguilar", "Espinoza", "Vega"],
  },
  luso_brazilian: {
    first_f: ["Ana", "Beatriz", "Larissa", "Camila", "Júlia", "Mariana", "Bruna", "Letícia", "Fernanda", "Amanda"],
    first_m: ["João", "Lucas", "Pedro", "Gabriel", "Felipe", "Bruno", "Rafael", "Tiago", "Vinícius", "Matheus"],
    last: ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Almeida", "Rodrigues", "Carvalho"],
  },
  afro_brazilian: {
    first_f: ["Dandara", "Iara", "Nzinga", "Aisha", "Maíra", "Yara", "Luana", "Janaína", "Solange", "Cíntia"],
    first_m: ["Tiago", "Marcelo", "Davi", "Caio", "Júnior", "Wellington", "Adilson", "Robson", "Émerson", "Sandro"],
    last: ["Nascimento", "dos Santos", "da Silva", "Conceição", "Pinto", "Barbosa", "Cardoso", "Moreira", "Ramos", "Gomes"],
  },
  italian_german_diaspora: {
    first_f: ["Giovanna", "Helena", "Bianca", "Heloísa", "Antonella", "Greta", "Vitória", "Isabella", "Liz", "Heloise"],
    first_m: ["Enzo", "Bernardo", "Henrique", "Otto", "Lorenzo", "Arthur", "Heitor", "Theo", "Murilo", "Davi"],
    last: ["Bianchi", "Ferrari", "Schneider", "Hoffmann", "Müller", "Bauer", "Conti", "Romano", "Wagner", "Fischer"],
  },
  arab: {
    first_f: ["Fatima", "Aisha", "Layla", "Mariam", "Yasmin", "Nour", "Sara", "Salma", "Hala", "Rania"],
    first_m: ["Mohammed", "Ahmed", "Ali", "Omar", "Yousef", "Hassan", "Khalid", "Tariq", "Karim", "Samir"],
    last: ["Hassan", "Mahmoud", "El-Sayed", "Khan", "Ibrahim", "Khalil", "Saleh", "Najjar", "Haddad", "Mansour"],
  },
  berber: {
    first_f: ["Tinhinan", "Dihya", "Tanit", "Yasmina", "Tamazight", "Lalla", "Itri", "Massa", "Tilelli", "Numidia"],
    first_m: ["Massin", "Idir", "Aksil", "Yidir", "Amayas", "Gaya", "Yuba", "Ziri", "Mokrane", "Meziane"],
    last: ["Ait Ali", "Amrani", "Belkacem", "Bouzid", "Hamadi", "Mokrani", "Tazi", "Berrada", "Ouali", "Taibi"],
  },
  french_colonial: {
    first_f: ["Amélie", "Camille", "Léa", "Sophie", "Inès", "Yasmine", "Salma", "Nadia", "Farah", "Sarah"],
    first_m: ["Karim", "Mehdi", "Yanis", "Rayan", "Adam", "Nassim", "Sami", "Walid", "Hichem", "Brahim"],
    last: ["Benali", "Bensaid", "Cherif", "Dahmani", "Saidi", "Boumediene", "Hadjadj", "Lazreg", "Belhadj", "Ferhat"],
  },
  west_african: {
    first_f: ["Chioma", "Aminata", "Adaeze", "Ngozi", "Ifeoma", "Fatou", "Aïcha", "Folake", "Yaa", "Akosua"],
    first_m: ["Chinedu", "Olumide", "Kwame", "Ousmane", "Ibrahim", "Tunde", "Babatunde", "Kofi", "Sekou", "Mamadou"],
    last: ["Okafor", "Adeyemi", "Mensah", "Diallo", "Traore", "Okonkwo", "Bello", "Owusu", "Sow", "Conté"],
  },
  east_african: {
    first_f: ["Amani", "Zuri", "Makena", "Neema", "Asha", "Hawa", "Sauda", "Tigist", "Hanan", "Salma"],
    first_m: ["Kamau", "Juma", "Daudi", "Tesfaye", "Yonas", "Abdi", "Hassan", "Bekele", "Mwangi", "Otieno"],
    last: ["Mwangi", "Otieno", "Kamau", "Tesfaye", "Bekele", "Abdullahi", "Mohamed", "Wanjiku", "Njoroge", "Hailu"],
  },
  southern_african: {
    first_f: ["Thandiwe", "Nomvula", "Lerato", "Zanele", "Ayanda", "Nokuthula", "Palesa", "Refilwe", "Boitumelo", "Lebo"],
    first_m: ["Sipho", "Thabo", "Bongani", "Mandla", "Lethabo", "Tshepo", "Kagiso", "Lwazi", "Sizwe", "Themba"],
    last: ["Mokoena", "Ndlovu", "Dlamini", "Khumalo", "Zulu", "Mthembu", "Nkosi", "Sibanda", "Moyo", "Mahlangu"],
  },
  christian_global: {
    first_f: ["Grace", "Mary", "Faith", "Joy", "Esther", "Ruth", "Hope", "Charity", "Blessing", "Precious"],
    first_m: ["John", "Emmanuel", "Daniel", "Samuel", "David", "Joseph", "Peter", "Paul", "Michael", "Joshua"],
    last: ["John", "Daniel", "Samuel", "Peter", "Paul", "Michael", "Joseph", "James", "Thomas", "Mark"],
  },
  muslim_global: {
    first_f: ["Aisha", "Fatima", "Khadija", "Maryam", "Zainab", "Hafsa", "Safiya", "Amina", "Nadia", "Habiba"],
    first_m: ["Mohammed", "Ahmed", "Ibrahim", "Ismail", "Yusuf", "Omar", "Bilal", "Hamza", "Idris", "Musa"],
    last: ["Mohammed", "Ibrahim", "Ahmed", "Ali", "Yusuf", "Hassan", "Hussein", "Abdullah", "Rahman", "Karim"],
  },
  arab_persian: {
    first_f: ["Shirin", "Yasmin", "Leila", "Parisa", "Nadia", "Farah", "Mariam", "Sara", "Layla", "Roya"],
    first_m: ["Reza", "Ali", "Hossein", "Mehdi", "Amir", "Omar", "Yousef", "Karim", "Bashar", "Rami"],
    last: ["Ahmadi", "Hosseini", "Karimi", "Rezaei", "Mansouri", "Najjar", "Haddad", "Khoury", "Saab", "Aziz"],
  },
  hindu: {
    first_f: ["Priya", "Anika", "Diya", "Ananya", "Ishita", "Meera", "Kavya", "Pooja", "Riya", "Aarya"],
    first_m: ["Arjun", "Rohan", "Vikram", "Aditya", "Rahul", "Karan", "Siddharth", "Aryan", "Dev", "Krishna"],
    last: ["Sharma", "Patel", "Gupta", "Kumar", "Singh", "Shah", "Verma", "Reddy", "Iyer", "Nair"],
  },
  muslim_sa: {
    first_f: ["Fatima", "Ayesha", "Zainab", "Maryam", "Sana", "Hina", "Sadia", "Rabia", "Noor", "Amina"],
    first_m: ["Mohammed", "Ahmed", "Hassan", "Ibrahim", "Imran", "Bilal", "Faisal", "Tariq", "Usman", "Zayd"],
    last: ["Khan", "Ahmed", "Ali", "Hussain", "Malik", "Sheikh", "Siddiqui", "Qureshi", "Rahman", "Akhtar"],
  },
  sikh: {
    first_f: ["Simran", "Harleen", "Mehar", "Gurleen", "Jasleen", "Manpreet", "Navjot", "Rupinder", "Sukhmani", "Amrit"],
    first_m: ["Arjun", "Harpreet", "Manjit", "Jaspreet", "Gurpreet", "Sukhdev", "Ranjit", "Davinder", "Inderpal", "Kuldeep"],
    last: ["Singh", "Kaur", "Gill", "Sandhu", "Dhillon", "Brar", "Bains", "Mann", "Sidhu", "Cheema"],
  },
  christian_sa: {
    first_f: ["Mary", "Anna", "Grace", "Sneha", "Reena", "Liya", "Sara", "Anjali", "Maria", "Susan"],
    first_m: ["Thomas", "Joseph", "George", "John", "Daniel", "Samuel", "Joshua", "Mathew", "Philip", "Abraham"],
    last: ["Thomas", "Joseph", "George", "Mathew", "John", "D'Souza", "Fernandes", "Pereira", "Mendes", "Rodrigues"],
  },
  east_asian_local: {
    first_f: ["Wei", "Mei", "Yuki", "Sakura", "Min-jun", "Ji-woo", "Xiao", "Hana", "Akari", "Hye-jin"],
    first_m: ["Wei", "Jun", "Hiroshi", "Takeshi", "Min-ho", "Seung", "Chen", "Haruto", "Ren", "Yusei"],
    last: ["Chen", "Wang", "Li", "Zhang", "Tanaka", "Sato", "Suzuki", "Kim", "Park", "Lee"],
  },
  east_asian_christian: {
    first_f: ["Grace", "Mary", "Esther", "Hannah", "Joy", "Ruth", "Faith", "Lydia", "Sarah", "Rebecca"],
    first_m: ["Daniel", "David", "Paul", "Peter", "John", "Mark", "Joseph", "Samuel", "Joshua", "Stephen"],
    last: ["Kim", "Park", "Lee", "Choi", "Chen", "Wong", "Lim", "Tan", "Ng", "Ho"],
  },
  southeast_asian_local: {
    first_f: ["Siti", "Putri", "Linh", "Mai", "Ploy", "Anong", "Aiko", "Indah", "Maya", "Dewi"],
    first_m: ["Aung", "Minh", "Tuan", "Somchai", "Budi", "Eko", "Made", "Nguyen", "Rizal", "Hadi"],
    last: ["Nguyen", "Tran", "Pham", "Lim", "Tan", "Wijaya", "Susanto", "Aung", "Wong", "Lee"],
  },
  chinese_diaspora: {
    first_f: ["Mei", "Ling", "Hui", "Xin", "Yan", "Hua", "Jia", "Wen", "Qing", "Ying"],
    first_m: ["Wei", "Jun", "Ming", "Bo", "Hao", "Jian", "Lei", "Tao", "Yu", "Zhi"],
    last: ["Lim", "Tan", "Wong", "Chen", "Lee", "Ng", "Ong", "Goh", "Teo", "Chua"],
  },
  muslim_sea: {
    first_f: ["Siti", "Nur", "Aisyah", "Farah", "Zara", "Hana", "Aina", "Liyana", "Aida", "Nadia"],
    first_m: ["Ahmad", "Mohd", "Adam", "Adib", "Faiz", "Hakim", "Iman", "Razif", "Syafiq", "Zaki"],
    last: ["Abdullah", "Ibrahim", "Yusof", "Hassan", "Ismail", "Rahman", "Othman", "Mansor", "Hamid", "Salleh"],
  },
  colonial_iberian_sea: {
    first_f: ["Maria", "Cristina", "Isabel", "Catalina", "Sofia", "Ana", "Andrea", "Carmen", "Lourdes", "Patricia"],
    first_m: ["Jose", "Juan", "Carlos", "Miguel", "Antonio", "Eduardo", "Ricardo", "Manuel", "Gabriel", "Rafael"],
    last: ["Santos", "Reyes", "Cruz", "Garcia", "Dela Cruz", "Mendoza", "Aquino", "Bautista", "del Rosario", "Marquez"],
  },
};

// ─── Region → mixture ────────────────────────────────────────────────────

type Mixture = Array<{ pool: keyof typeof POOLS; weight: number }>;

const MIXTURES: Record<Region, Mixture> = {
  iberia: [
    { pool: "iberian", weight: 0.7 },
    { pool: "latin_european", weight: 0.2 },
    { pool: "global_anglo", weight: 0.1 },
  ],
  western_europe: [
    { pool: "western_european", weight: 0.6 },
    { pool: "latin_european", weight: 0.25 },
    { pool: "global_anglo", weight: 0.15 },
  ],
  eastern_europe: [
    { pool: "slavic", weight: 0.65 },
    { pool: "germanic", weight: 0.2 },
    { pool: "global_anglo", weight: 0.15 },
  ],
  north_america: [
    { pool: "global_anglo", weight: 0.45 },
    { pool: "hispanic", weight: 0.25 },
    { pool: "east_asian_local", weight: 0.15 },
    { pool: "hindu", weight: 0.1 },
    { pool: "west_african", weight: 0.05 },
  ],
  latam: [
    { pool: "hispanic", weight: 0.7 },
    { pool: "indigenous_mestizo", weight: 0.2 },
    { pool: "global_catholic", weight: 0.1 },
  ],
  brazil: [
    { pool: "luso_brazilian", weight: 0.55 },
    { pool: "afro_brazilian", weight: 0.2 },
    { pool: "italian_german_diaspora", weight: 0.15 },
    { pool: "global_anglo", weight: 0.1 },
  ],
  maghreb: [
    { pool: "arab", weight: 0.7 },
    { pool: "berber", weight: 0.2 },
    { pool: "french_colonial", weight: 0.1 },
  ],
  sub_saharan_africa: [
    { pool: "west_african", weight: 0.35 },
    { pool: "east_african", weight: 0.15 },
    { pool: "southern_african", weight: 0.1 },
    { pool: "christian_global", weight: 0.25 },
    { pool: "muslim_global", weight: 0.15 },
  ],
  middle_east: [
    { pool: "arab_persian", weight: 0.8 },
    { pool: "christian_global", weight: 0.2 },
  ],
  south_asia: [
    { pool: "hindu", weight: 0.5 },
    { pool: "muslim_sa", weight: 0.25 },
    { pool: "sikh", weight: 0.15 },
    { pool: "christian_sa", weight: 0.1 },
  ],
  east_asia: [
    { pool: "east_asian_local", weight: 0.9 },
    { pool: "east_asian_christian", weight: 0.1 },
  ],
  southeast_asia: [
    { pool: "southeast_asian_local", weight: 0.5 },
    { pool: "chinese_diaspora", weight: 0.25 },
    { pool: "muslim_sea", weight: 0.15 },
    { pool: "colonial_iberian_sea", weight: 0.1 },
  ],
  global: [
    { pool: "global_anglo", weight: 0.18 },
    { pool: "iberian", weight: 0.08 },
    { pool: "luso_brazilian", weight: 0.08 },
    { pool: "hispanic", weight: 0.12 },
    { pool: "hindu", weight: 0.12 },
    { pool: "east_asian_local", weight: 0.12 },
    { pool: "arab", weight: 0.1 },
    { pool: "west_african", weight: 0.08 },
    { pool: "western_european", weight: 0.07 },
    { pool: "southeast_asian_local", weight: 0.05 },
  ],
};

// ─── Locale → Region ─────────────────────────────────────────────────────

export function detectRegionFromLocale(locale: string | undefined | null): Region {
  if (!locale) return "global";
  const lc = locale.toLowerCase().replace("_", "-");
  // explicit country wins
  if (lc.startsWith("pt-br")) return "brazil";
  if (lc.startsWith("pt")) return "iberia";
  if (lc.startsWith("es-")) {
    const cc = lc.slice(3, 5);
    if (["mx","ar","cl","co","pe","uy","ve","bo","ec","py","cr","gt","hn","ni","pa","sv","do","cu","pr"].includes(cc)) return "latam";
    return "iberia";
  }
  if (lc.startsWith("es")) return "iberia";
  if (lc.startsWith("fr")) {
    if (lc.includes("-ma") || lc.includes("-dz") || lc.includes("-tn")) return "maghreb";
    return "western_europe";
  }
  if (lc.startsWith("ar")) {
    if (lc.includes("-ma") || lc.includes("-dz") || lc.includes("-tn") || lc.includes("-ly") || lc.includes("-eg")) return "maghreb";
    return "middle_east";
  }
  if (lc.startsWith("hi") || lc.startsWith("bn") || lc.startsWith("ur") || lc.startsWith("ta") || lc.startsWith("te")) return "south_asia";
  if (lc.startsWith("zh") || lc.startsWith("ja") || lc.startsWith("ko")) return "east_asia";
  if (lc.startsWith("th") || lc.startsWith("vi") || lc.startsWith("id") || lc.startsWith("ms") || lc.startsWith("tl")) return "southeast_asia";
  if (lc.startsWith("sw") || lc.startsWith("am") || lc.startsWith("ha") || lc.startsWith("yo") || lc.startsWith("ig") || lc.startsWith("zu")) return "sub_saharan_africa";
  if (lc.startsWith("de") || lc.startsWith("nl") || lc.startsWith("da") || lc.startsWith("sv") || lc.startsWith("no") || lc.startsWith("fi")) return "western_europe";
  if (lc.startsWith("it")) return "western_europe";
  if (lc.startsWith("pl") || lc.startsWith("cs") || lc.startsWith("ru") || lc.startsWith("uk") || lc.startsWith("hu") || lc.startsWith("ro")) return "eastern_europe";
  if (lc.startsWith("en-us") || lc.startsWith("en-ca")) return "north_america";
  if (lc.startsWith("en")) return "global";
  return "global";
}

// ─── Deterministic PRNG ──────────────────────────────────────────────────

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPoolKey(mix: Mixture, rand: () => number): keyof typeof POOLS {
  const total = mix.reduce((s, m) => s + m.weight, 0);
  let r = rand() * total;
  for (const m of mix) {
    r -= m.weight;
    if (r <= 0) return m.pool;
  }
  return mix[mix.length - 1]!.pool;
}

function pickFrom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

// ─── Public API ──────────────────────────────────────────────────────────

export function generateName(opts: {
  region: Region;
  sex: Sex;
  seed: number | string;
}): NameRecord {
  const seed = typeof opts.seed === "string" ? fnv1a(opts.seed) : opts.seed >>> 0;
  const rand = mulberry32(seed || 1);
  const mix = MIXTURES[opts.region] ?? MIXTURES.global;
  const poolKey = pickPoolKey(mix, rand);
  const pool = POOLS[poolKey]!;
  const first = pickFrom(opts.sex === "f" ? pool.first_f : pool.first_m, rand);
  const last = pickFrom(pool.last, rand);
  return { first, last, full: `${first} ${last}`, sex: opts.sex, subPool: poolKey };
}

/**
 * Gender-balanced roster of `count` names. Deterministic in `seed`.
 * Avoids duplicate full names within the same roster.
 */
export function generateRoster(opts: {
  region: Region;
  count: number;
  seed: number | string;
}): NameRecord[] {
  const baseSeed = typeof opts.seed === "string" ? fnv1a(opts.seed) : opts.seed >>> 0;
  const out: NameRecord[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (out.length < opts.count && attempts < opts.count * 8) {
    const sex: Sex = out.length % 2 === 0 ? "f" : "m";
    const n = generateName({ region: opts.region, sex, seed: baseSeed + out.length * 1009 + attempts * 17 });
    if (!seen.has(n.full)) {
      seen.add(n.full);
      out.push(n);
    }
    attempts++;
  }
  return out;
}

export function initialsFor(name: { first: string; last: string }): string {
  return `${name.first[0] ?? ""}${name.last[0] ?? ""}`.toUpperCase();
}