// Single source of truth for the page and the terminal. Edit here.
import type { Education, OrbitArc, Profile, Project, StackGroup, VirtualFiles } from '../types';

export const profile: Profile = {
  name: 'Jailton Santos',
  user: 'jailton',
  role: 'Desenvolvedor Full-stack',
  status: 'aberto a oportunidades',
  github: 'https://github.com/Jayzmatos22',
  githubLabel: 'github.com/Jayzmatos22',
  email: 'jailtonmatos200@gmail.com',
  // TODO: preencha para aparecer em "contato" e no terminal
  linkedin: '',
  linkedinLabel: '',
};

export const education: readonly Education[] = [
  {
    course: 'Análise e Desenvolvimento de Sistemas',
    degree: 'Tecnólogo',
    institution: 'Unisa',
    completion: '2027-07',
    inProgress: true,
  },
];

export const projects: readonly Project[] = [
  {
    id: 'myworld',
    index: '01',
    name: 'MyWorld',
    kind: 'Full-stack · Serverless · IA',
    status: 'online',
    summary:
      'Um arquivo editorial do céu: a Astronomy Picture of the Day da NASA desde 1995, com um assistente de IA para conversar sobre cada imagem.',
    highlights: [
      'API em FastAPI que busca, normaliza e faz cache do APOD direto do science.nasa.gov',
      '"Pergunte à placa": ponte para 3 provedores de LLM (NVIDIA, Groq, Google), com provedor e modelo validados no servidor',
      'Curtidas, ranking e rate limit no DynamoDB, com IP anonimizado',
      '100% serverless no nível gratuito da AWS: Lambda + Mangum, S3 + CloudFront, alarmes no CloudWatch',
    ],
    stack: ['Python 3.13', 'FastAPI', 'Pydantic v2', 'AWS Lambda', 'DynamoDB', 'S3 + CloudFront', 'AWS SAM', 'React 19', 'TypeScript', 'WebGL'],
    links: { live: 'https://d3qm8fzq1hw1xt.cloudfront.net/', repo: 'https://github.com/Jayzmatos22/MyWorld' },
    visual: 'blackhole',
  },
  {
    id: 'brasilpanel',
    index: '02',
    name: 'Brasil Panel',
    kind: 'Full-stack · Dados · Finanças',
    status: 'em produção',
    summary:
      'Painel de dados econômicos e financeiros do Brasil: indicadores oficiais, cotações, séries históricas e dados geográficos numa interface rápida.',
    highlights: [
      'Back-end em Spring Boot que integra 10 APIs públicas e privadas: BCB, IBGE, IPEA, World Bank, CoinGecko e outras',
      'Persistência em PostgreSQL com JPA/Hibernate e pool de conexões HikariCP',
      'Autenticação JWT em cookie HttpOnly com Spring Security',
      'Cache Caffeine com TTL por domínio, Swagger, container no Render e banco serverless no Neon',
    ],
    stack: ['Java 21', 'Spring Boot 3.5', 'Spring Security', 'JPA / Hibernate', 'PostgreSQL', 'Caffeine', 'Docker', 'React 19', 'TanStack Query'],
    links: { live: '', repo: 'https://github.com/Jayzmatos22/brasil_panel_utilities-api' },
    visual: 'market',
  },
];

export const stack: readonly StackGroup[] = [
  {
    group: 'linguagens',
    items: [
      ['Java 21', 'brasilpanel'],
      ['Python 3.13', 'myworld'],
      ['TypeScript', 'ambos'],
      ['SQL', 'brasilpanel'],
    ],
  },
  {
    group: 'back-end',
    items: [
      ['Spring Boot', 'brasilpanel'],
      ['Spring Security · JWT', 'brasilpanel'],
      ['JPA / Hibernate', 'brasilpanel'],
      ['FastAPI', 'myworld'],
      ['Pydantic v2', 'myworld'],
    ],
  },
  {
    group: 'dados',
    items: [
      ['PostgreSQL', 'brasilpanel'],
      ['DynamoDB', 'myworld'],
      ['Caffeine cache', 'brasilpanel'],
      ['HikariCP', 'brasilpanel'],
      ['APIs REST externas', 'ambos'],
    ],
  },
  {
    group: 'cloud & devops',
    items: [
      ['AWS Lambda · SAM', 'myworld'],
      ['S3 + CloudFront', 'myworld'],
      ['Docker', 'brasilpanel'],
      ['Render · Neon', 'brasilpanel'],
      ['CloudWatch · SNS', 'myworld'],
    ],
  },
  {
    group: 'front-end',
    items: [
      ['React 19', 'ambos'],
      ['Tailwind CSS 4', 'ambos'],
      ['Vite', 'ambos'],
      ['TanStack Query', 'brasilpanel'],
      ['WebGL', 'myworld'],
    ],
  },
];

export const arcs: readonly OrbitArc[] = [
  { r: 300, from: -30, to: 30, dot: -14, title: 'Java', label: 'SPRING BOOT · JPA' },
  { r: 360, from: -42, to: 44, dot: 12, title: 'Python', label: 'FASTAPI · PYDANTIC' },
  { r: 420, from: -50, to: 52, dot: 36, title: 'AWS', label: 'LAMBDA · DYNAMODB' },
];

export const files: VirtualFiles = {
  'sobre.md': [
    '# sobre',
    '',
    'Desenvolvedor full-stack, com foco em back-end. Construo o lado que ninguém vê:',
    'APIs, integrações, cache, autenticação e infraestrutura.',
    '',
    'Hoje: Java + Spring Boot e Python + FastAPI, do banco ao deploy.',
  ],
  'contato.txt': ['rode: contato'],
  'stack.txt': ['rode: stack'],
  '.segredo': [
    'parabéns, você achou o arquivo escondido.',
    'se você chegou até aqui, a gente provavelmente deveria conversar.',
    '→ contato',
  ],
};
