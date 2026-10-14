import './FixedSkillImage.css';

type Category = 'language' | 'web' | 'server' | 'database' | 'infra' | 'ai' | 'custom';
type Definition = { category: Category; mark: string };

// The curated V37/V39 system catalog gets a stable emblem; new account skills use a name-based fallback.
const groups: Record<Category, Record<string, string>> = {
  language: {
    JavaScript: 'JS', TypeScript: 'TS', Python: 'Py', Java: 'Jv', 'C#': 'C#', 'C++': 'C++',
    C: 'C', Go: 'Go', Kotlin: 'Kt', Swift: 'Sw', Rust: 'Rs', PHP: 'PHP', Ruby: 'Rb',
    Dart: 'Dt', SQL: 'SQL',
  },
  web: {
    React: 'Re', 'Next.js': 'Nx', 'Vue.js': 'Vue', Nuxt: 'Nu', Angular: 'Ng',
    Svelte: 'Sv', HTML: 'HT', CSS: 'CSS', 'Tailwind CSS': 'Tw',
    Flutter: 'Ft', 'React Native': 'RN',
  },
  server: {
    'Spring Boot': 'SB', 'Spring Framework': 'SF', 'Node.js': 'No', Express: 'Ex',
    NestJS: 'Ns', Django: 'Dj', FastAPI: 'FA', Flask: 'Fl', 'ASP.NET Core': 'NET',
    Laravel: 'Lv', 'Ruby on Rails': 'RoR',
  },
  database: {
    PostgreSQL: 'Pg', MySQL: 'My', MariaDB: 'Md', SQLite: 'Sq',
    'Microsoft SQL Server': 'MS', 'Oracle Database': 'Or', MongoDB: 'Mg',
    Redis: 'Rd', Elasticsearch: 'Es',
  },
  infra: {
    Docker: 'Dk', Kubernetes: 'K8', AWS: 'AWS', Git: 'Git', 'GitHub Actions': 'GH',
    Jenkins: 'Jk',
  },
  ai: {
    PyTorch: 'Pt', TensorFlow: 'TF', 'scikit-learn': 'Sk',
    'Hugging Face Transformers': 'HF', LangChain: 'LC', LangGraph: 'LG',
    LlamaIndex: 'LI', RAG: 'RAG', Ollama: 'Ol', vLLM: 'vL', MLflow: 'ML',
    pandas: 'pd', NumPy: 'Np', 'Apache Spark': 'Sp',
  },
  custom: {},
};

const palettes: Record<Category, { background: string; border: string; ink: string; light: string }> = {
  language: { background: '#e8f2ff', border: '#5299eb', ink: '#1451a3', light: '#a5d2ff' },
  web: { background: '#f1ebff', border: '#9470e8', ink: '#5633ae', light: '#d0bafa' },
  server: { background: '#e6f7eb', border: '#54af75', ink: '#1e7b45', light: '#a9dfb9' },
  database: { background: '#fff1dc', border: '#dda34d', ink: '#92550c', light: '#f8cd85' },
  infra: { background: '#e6f7fa', border: '#54b5c7', ink: '#137386', light: '#a0dce5' },
  ai: { background: '#ffeaf3', border: '#df70a0', ink: '#a12765', light: '#f5b9d2' },
  custom: { background: '#f1f2fa', border: '#9ca7c8', ink: '#454e80', light: '#cdd4e9' },
};

const motifs: Record<Category, string> = {
  language: '<path d="M5 8h3v2H6v3h2v2H5v-2H3v-3h2zm22 0h-3v2h2v3h-2v2h3v-2h2v-3h-2z" />',
  web: '<path d="M4 6h24v3H4zm2 5h4v3H6zm16 0h4v3h-4z" />',
  server: '<path d="M4 6h24v3H4zm0 5h24v2H4zm0 4h24v2H4z" />',
  database: '<path d="M6 7h20v2H6zm-2 4h24v2H4zm2 4h20v2H6z" />',
  infra: '<path d="M6 12h3V9h3V7h8v2h3v3h3v5H6z" />',
  ai: '<path d="M5 8h3v3h3V7h3v4h4V7h3v4h3V8h3v9h-3v-3h-3v4h-3v-4h-4v4h-3v-4H8v3H5z" />',
  custom: '<path d="M5 7h22v2H5zm0 4h4v4H5zm18 0h4v4h-4z" />',
};

const definitions = new Map<string, Definition>(
  Object.entries(groups).flatMap(([category, names]) =>
    Object.entries(names).map(([name, mark]) => [name, { category: category as Category, mark }] as const)),
);
const cached = new Map<string, string>();

export function fixedSkillImageUrl(name: string): string {
  const definition = definitions.get(name) ?? {
    category: 'custom',
    mark: Array.from(name.normalize('NFC')).filter(character => /[\p{L}\p{N}]/u.test(character)).slice(0, 2).join('').toUpperCase() || '?',
  };
  const cacheKey = `${definition.category}:${name}`;
  const found = cached.get(cacheKey);
  if (found) return found;
  const palette = palettes[definition.category];
  const fontSize = definition.mark.length > 2 ? 9 : 11;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="6" fill="${palette.background}"/>
    <path d="M4 2h24v2h2v24h-2v2H4v-2H2V4h2z" fill="${palette.border}"/>
    <rect x="4" y="4" width="24" height="24" rx="3" fill="${palette.background}"/>
    <g fill="${palette.light}" opacity=".85">${motifs[definition.category]}</g>
    <rect x="5" y="17" width="22" height="10" rx="2" fill="${palette.background}" opacity=".94"/>
    <text x="16" y="25" text-anchor="middle" font-family="ui-monospace,monospace" font-size="${fontSize}" font-weight="900" fill="${palette.ink}">${definition.mark.replaceAll('&', '&amp;')}</text>
    <rect x="6" y="5" width="2" height="2" fill="#fff" opacity=".9"/>
  </svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cached.set(cacheKey, url);
  return url;
}

export function FixedSkillImage({ name, className = '' }: {
  name: string; className?: string;
}) {
  return <img className={`fixed-skill-image ${className}`.trim()} src={fixedSkillImageUrl(name)} alt="" aria-hidden="true" />;
}
