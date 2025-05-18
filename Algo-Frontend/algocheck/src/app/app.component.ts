import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  questionNumber: number | null = null;
  code: string = '';
  result: string | null = null;
  coversAllEdges: boolean = false;
  qualityScore: number | null = null;
  companyName: string | null = null;
  optimizedCode: string | null = null;
  readinessScore: number | null = null;
  privateNotes: string = '';
  copied = false;
  loadingAnalysis = false;
  loadingCompany = false;
  loadingOptimize = false;

  constructor(private http: HttpClient) {}

  analyzeCode() {
    if (!this.questionNumber || !this.code.trim()) return;

    this.loadingAnalysis = true;
    this.result = null;
    this.qualityScore = null;
    this.coversAllEdges = false;
    this.readinessScore = null;

    this.http.post<any>('https://algocheck.onrender.com/analyze', {
      questionNumber: this.questionNumber,
      code: this.code
    }).subscribe({
      next: res => {
        this.result = res.result;
        this.qualityScore = res.qualityScore;
        this.coversAllEdges = res.coversAllEdges;
        this.readinessScore = this.calculateReadinessScore(res);
        this.loadingAnalysis = false;
      },
      error: err => {
        this.result = err.error?.full || 'Analysis failed.';
        this.qualityScore = null;
        this.coversAllEdges = false;
        this.readinessScore = null;
        this.loadingAnalysis = false;
      }
    });
  }

  tagCompany() {
    if (!this.questionNumber) return;

    this.loadingCompany = true;
    this.companyName = null;

    this.http.post<any>('https://algocheck.onrender.com/company', {
      questionNumber: this.questionNumber
    }).subscribe({
      next: res => {
        this.companyName = res.company;
        this.loadingCompany = false;
      },
      error: () => {
        this.companyName = 'Unable to determine company.';
        this.loadingCompany = false;
      }
    });
  }

  copyResultToClipboard() {
    if (!this.result) return;

    navigator.clipboard.writeText(this.result).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  extractTimeComplexity(text: string): string {
    const match = /Time Complexity.*?O\((.*?)\)/i.exec(text);
    return match ? `O(${match[1]})` : 'Unknown';
  }

  extractSpaceComplexity(text: string): string {
    const match = /Space Complexity.*?O\((.*?)\)/i.exec(text);
    return match ? `O(${match[1]})` : 'Unknown';
  }

  getResultColor(text: string): string {
    const timeMatch = /Time Complexity.*?O\((.*?)\)/i.exec(text);
    if (!timeMatch) return 'text-red-500';

    const val = timeMatch[1].toLowerCase();
    if (['1', 'logn', 'n'].includes(val)) return 'text-green-400';
    if (['nlogn', 'n+n'].some(x => val.includes(x))) return 'text-yellow-400';
    return 'text-red-500';
  }

  getQualityColor(score: number | null): string {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-500';
  }

  calculateReadinessScore(res: any): number {
    const timeWeight = 25;
    const spaceWeight = 20;
    const qualityWeight = 30;
    const edgeWeight = 25;

    const timeVal = /O\((.*?)\)/i.exec(res.result)?.[1]?.toLowerCase() ?? '';
    let timeScore = 0;
    if (['1', 'logn'].includes(timeVal)) timeScore = 100;
    else if (timeVal === 'n') timeScore = 80;
    else if (timeVal.includes('nlogn')) timeScore = 60;
    else if (timeVal.includes('n^2')) timeScore = 30;

    const edgeScore = res.coversAllEdges ? 100 : 40;

    const total = (
      (timeScore * timeWeight) +
      (100 * spaceWeight) +
      (res.qualityScore * qualityWeight) +
      (edgeScore * edgeWeight)
    ) / 100;

    return Math.round(total);
  }
}