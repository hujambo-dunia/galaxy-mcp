const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "have", "want",
  "data", "this", "that", "are", "was", "will",
]);

/**
 * Tokenize text for BM25 search: extract alpha words >=2 chars, lowercase, drop stopwords.
 */
export function tokenizeForSearch(text: string): string[] {
  const tokens: string[] = [];
  const regex = /\b[a-zA-Z]{2,}\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const tok = match[0].toLowerCase();
    if (!STOPWORDS.has(tok)) {
      tokens.push(tok);
    }
  }
  return tokens;
}

/**
 * BM25Okapi implementation matching rank_bm25.BM25Okapi defaults.
 * k1=1.5, b=0.75, epsilon=0.25
 */
export class BM25Okapi {
  private readonly k1 = 1.5;
  private readonly b = 0.75;
  private readonly epsilon = 0.25;

  private readonly N: number;
  private readonly avgdl: number;
  private readonly docFreqs: Array<Map<string, number>>;
  private readonly docLens: number[];
  private readonly idf: Map<string, number>;

  constructor(corpus: string[][]) {
    this.N = corpus.length;
    this.docFreqs = [];
    this.docLens = [];

    const nd = new Map<string, number>(); // word -> number of docs containing it

    let totalLen = 0;
    for (const doc of corpus) {
      const tf = new Map<string, number>();
      for (const word of doc) {
        tf.set(word, (tf.get(word) ?? 0) + 1);
      }
      this.docFreqs.push(tf);
      this.docLens.push(doc.length);
      totalLen += doc.length;

      for (const word of tf.keys()) {
        nd.set(word, (nd.get(word) ?? 0) + 1);
      }
    }

    this.avgdl = this.N > 0 ? totalLen / this.N : 0;
    this.idf = this._computeIdf(nd);
  }

  private _computeIdf(nd: Map<string, number>): Map<string, number> {
    const idfMap = new Map<string, number>();
    if (this.N === 0) return idfMap;

    let idfSum = 0;
    const negatives: string[] = [];

    for (const [word, freq] of nd.entries()) {
      const idf = Math.log(this.N - freq + 0.5) - Math.log(freq + 0.5);
      idfMap.set(word, idf);
      idfSum += idf;
      if (idf < 0) negatives.push(word);
    }

    const numWords = nd.size;
    const averageIdf = numWords > 0 ? idfSum / numWords : 0;
    const eps = this.epsilon * averageIdf;

    for (const word of negatives) {
      idfMap.set(word, eps);
    }

    return idfMap;
  }

  getScores(query: string[]): number[] {
    if (this.N === 0) return [];

    const scores = new Array<number>(this.N).fill(0);

    for (const q of query) {
      const idf = this.idf.get(q);
      if (idf === undefined) continue;

      for (let i = 0; i < this.N; i++) {
        const docTf = this.docFreqs[i];
        const dl = this.docLens[i];
        if (docTf === undefined || dl === undefined) continue;
        const f = docTf.get(q) ?? 0;
        if (f === 0) continue;
        const denom = f + this.k1 * (1 - this.b + this.b * dl / (this.avgdl || 1));
        const slot = scores[i];
        if (slot !== undefined) {
          scores[i] = slot + idf * (f * (this.k1 + 1)) / denom;
        }
      }
    }

    return scores;
  }
}
