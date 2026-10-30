// Seleção inicial de vídeos longos. Pesquisados no YouTube em 30/10/2026.
// t: tema (historia | filosofia | ciencia | geopolitica), d: duração em minutos.
export const VIDEOS = [
  // História
  { id: "fM1CyZ372qQ", t: "historia", l: "pt", d: 59, c: "Foca na História", title: "O Egito Antigo: a história completa" },
  { id: "kWSPcu56kPg", t: "historia", l: "pt", d: 51, c: "Foca na História", title: "Civilizações da Idade do Bronze: babilônios, sumérios, fenícios" },
  { id: "cmGmJLC-CNo", t: "historia", l: "pt", d: 55, c: "Um Documentário", title: "Os sumérios: a primeira civilização" },
  { id: "GR1F2wlr00Q", t: "historia", l: "pt", d: 46, c: "Foca na História", title: "Júlio César: ascensão e queda" },
  { id: "HJoTDAO_85I", t: "historia", l: "pt", d: 34, c: "Foca na História", title: "Aníbal: o homem que aterrorizou Roma" },
  { id: "kgrjIiQNOYs", t: "historia", l: "pt", d: 31, c: "Foca na História", title: "A Guerra do Peloponeso" },
  { id: "l4cy3ni-4dE", t: "historia", l: "pt", d: 103, c: "Tinocando TV", title: "Um tour pela Grécia Antiga" },
  { id: "XpIQw1QoQGA", t: "historia", l: "pt", d: 25, c: "Foca na História", title: "O Império Mongol: ascensão e queda" },
  { id: "4BmrcZ-TEtQ", t: "historia", l: "pt", d: 21, c: "Reconstrução Histórica", title: "Os vikings: como desapareceu o povo mais temido" },
  { id: "hlstRjozw_0", t: "historia", l: "pt", d: 24, c: "Foca na História", title: "Templários, hospitalários e teutônicos" },
  { id: "3-GICRxg0T8", t: "historia", l: "pt", d: 28, c: "Tinocando TV", title: "A Peste Negra e o caos na Idade Média" },
  { id: "l53BJ26RXnw", t: "historia", l: "pt", d: 79, c: "Canal Nostalgia", title: "Como a Revolução Francesa mudou o mundo" },
  { id: "ceCcZooYDBo", t: "historia", l: "pt", d: 55, c: "Débora Aladim", title: "Revolução Francesa: tudo que você precisa saber" },
  { id: "9UWhEjeQs40", t: "historia", l: "pt", d: 38, c: "Débora Aladim", title: "A Revolução Russa" },
  { id: "4rdHn3_Hr3M", t: "historia", l: "pt", d: 68, c: "EconoSimples", title: "História da Rússia" },
  { id: "TV4Vzda09Ck", t: "historia", l: "pt", d: 85, c: "Canal Nostalgia", title: "A Segunda Guerra Mundial" },
  { id: "6Gi4_GJXO4I", t: "historia", l: "pt", d: 57, c: "Canal Nostalgia", title: "Guerra Fria: EUA contra URSS" },
  { id: "q7E4XrfGGnE", t: "historia", l: "pt", d: 58, c: "Canal Nostalgia", title: "500 anos em 1 hora: História do Brasil" },
  { id: "JxuLyxfVeBU", t: "historia", l: "pt", d: 31, c: "O Elo Perdido", title: "Império do Brasil: a monarquia brasileira" },

  // Filosofia
  { id: "eOed-ZxFOzQ", t: "filosofia", l: "pt", d: 38, c: "Foca na História", title: "Sócrates, Platão e Aristóteles" },
  { id: "sNotryWJ-io", t: "filosofia", l: "pt", d: 70, c: "Nova Acrópole", title: "O que Platão ainda tem a nos ensinar" },
  { id: "Y9_UovLgduo", t: "filosofia", l: "pt", d: 79, c: "Epifania Experiência", title: "Toda a história da filosofia, parte 1" },
  { id: "BJZVW2kwT5c", t: "filosofia", l: "pt", d: 22, c: "Clóvis de Barros", title: "Aristóteles: Ética (parte 1)" },
  { id: "19LeAD6BMek", t: "filosofia", l: "pt", d: 53, c: "Nova Acrópole", title: "Epicteto e a arte de viver: o estoicismo na prática" },
  { id: "mLoGDtYrFl4", t: "filosofia", l: "pt", d: 20, c: "Tinocando TV", title: "Entenda a filosofia de Immanuel Kant" },
  { id: "gx2cEtI4Z1o", t: "filosofia", l: "pt", d: 102, c: "Isto não é Filosofia", title: "A ética de Kant (aula)" },
  { id: "jbu_4pi0AWI", t: "filosofia", l: "pt", d: 53, c: "Prazer, Karnal", title: "Nietzsche: por onde começar?" },
  { id: "zCc8QoSGdcU", t: "filosofia", l: "pt", d: 110, c: "Isto não é Filosofia", title: "Friedrich Nietzsche (aula)" },
  { id: "QXKekuz_O64", t: "filosofia", l: "pt", d: 29, c: "Tinocando TV", title: "Um tour pelo existencialismo" },
  { id: "6ra45z_DWi4", t: "filosofia", l: "pt", d: 90, c: "Território Conhecimento", title: "Sartre e o existencialismo" },
  { id: "GnaXyrFG-bU", t: "filosofia", l: "pt", d: 50, c: "Café Filosófico CPFL", title: "Sartre: política, ética e engajamento" },

  // Ciência
  { id: "aW0pfYlmzi0", t: "ciencia", l: "pt", d: 78, c: "Astrum Brasil", title: "O que sabemos sobre os buracos negros" },
  { id: "yLZS_eumO5A", t: "ciencia", l: "pt", d: 24, c: "ATLAS Studios", title: "Sérgio Sacani explica buracos negros" },
  { id: "GcrHEfm5bHc", t: "ciencia", l: "pt", d: 76, c: "Horizonte de Eventos", title: "Sistema Solar: uma viagem pela nossa casa" },
  { id: "6fsuiVHtEfc", t: "ciencia", l: "pt", d: 51, c: "Ciência Todo Dia", title: "Reação em cadeia: a história da bomba atômica" },
  { id: "4Qs_ORptaw8", t: "ciencia", l: "pt", d: 24, c: "Ciência Todo Dia", title: "Por que os aviões pararam no tempo?" },
  { id: "tDWeCwF-1dA", t: "ciencia", l: "pt", d: 63, c: "Canal Nostalgia", title: "Marie Curie e a ciência moderna" },
  { id: "VS-kn7N6N8M", t: "ciencia", l: "pt", d: 57, c: "ABC Terra", title: "A evolução humana: quando não estávamos sozinhos" },
  { id: "tXzbMRxBJ9o", t: "ciencia", l: "pt", d: 75, c: "Um Documentário", title: "Qual a origem da humanidade?" },
  { id: "P7k83dJ9oZ0", t: "ciencia", l: "pt", d: 51, c: "Estúdio Criativo", title: "O nascimento da mente" },
  { id: "JN4XjO8s16Q", t: "ciencia", l: "pt", d: 22, c: "Desvende & Descubra", title: "O que é a física quântica?" },

  // Geopolítica
  { id: "Woa6SuUqZDk", t: "geopolitica", l: "pt", d: 65, c: "Professor HOC", title: "Geopolítica: uma visão de mundo" },
  { id: "ALFYCUKB42s", t: "geopolitica", l: "pt", d: 187, c: "Professor HOC", title: "Geopolítica dos Estados Unidos" },
  { id: "iGIQz69UPPc", t: "geopolitica", l: "pt", d: 22, c: "Professor HOC", title: "Geopolítica da Rússia" },
  { id: "MBuFGuIXks0", t: "geopolitica", l: "pt", d: 67, c: "Professor HOC", title: "Geopolítica do dólar" },
  { id: "2fRg_D6ofvc", t: "geopolitica", l: "pt", d: 46, c: "Professor HOC", title: "Geopolítica dos Estados falidos" },
  { id: "DZXSSVwOX7M", t: "geopolitica", l: "pt", d: 27, c: "Professor HOC", title: "O que saber sobre o Oriente Médio" },
  { id: "M0grDiOLxwg", t: "geopolitica", l: "pt", d: 44, c: "Ricardo Marcílio", title: "Oriente Médio (aula completa)" },
  { id: "LmShtQMtciI", t: "geopolitica", l: "pt", d: 60, c: "Canal Nostalgia", title: "Entenda a guerra entre Rússia e Ucrânia" },
  { id: "5MjgVTeXEr8", t: "geopolitica", l: "pt", d: 43, c: "AUVP Capital", title: "A China vai superar os Estados Unidos?" },
];

export const TOPICS = {
  historia: "História",
  filosofia: "Filosofia",
  ciencia: "Ciência",
  geopolitica: "Geopolítica",
};
