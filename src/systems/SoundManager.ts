/**
 * SoundManager - Web Audio API 기반 사운드 엔진
 * 오실레이터를 이용한 레트로 효과음 생성 (외부 파일 불필요)
 */
class SoundManager {
    ctx: AudioContext | null;
    muted: boolean;
    initialized: boolean;

    constructor() {
        this.ctx = null;
        this.muted = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            this.ctx = new Ctx();
            this.initialized = true;
        } catch {
            console.warn('Web Audio API not supported');
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    _ensureReady() {
        if (!this.initialized) this.init();
        if (this.muted || !this.ctx) return false;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
    }

    _createNodes(): any {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        return { osc, gain, now: this.ctx!.currentTime };
    }

    play(type: any) {
        if (!this._ensureReady()) return;

        switch (type) {
            case 'hover': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            }

            case 'click': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }

            case 'error': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            }

            case 'attack': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }

            case 'levelUp':
                // Arpeggio (별도 오실레이터 생성하지 않음)
                this._playTone(523.25, 0.1, 0);       // C5
                this._playTone(659.25, 0.1, 0.1);     // E5
                this._playTone(783.99, 0.1, 0.2);     // G5
                this._playTone(1046.50, 0.3, 0.3);    // C6
                break;

            case 'item': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            }

            case 'heal':
                this._playTone(523.25, 0.12, 0);    // C5
                this._playTone(659.25, 0.12, 0.1);  // E5
                this._playTone(783.99, 0.2, 0.2);   // G5
                break;

            case 'death':
                this._playTone(400, 0.15, 0);
                this._playTone(300, 0.15, 0.12);
                this._playTone(200, 0.15, 0.24);
                this._playTone(100, 0.4, 0.36);
                break;

            case 'skill': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }

            // cycle 118: 첫 방문 지역 — D major triad 3음 짧은 arpeggio.
            // discovery_chain(G major 4음 0.6s)보다 가볍고 짧음 — 첫 방문은 빈번한
            // 이벤트라 사운드 길이를 최소화 (0.3s 합).
            case 'new_area':
                this._playTone(587.33, 0.08, 0);     // D5
                this._playTone(739.99, 0.08, 0.08);  // F#5
                this._playTone(880.00, 0.16, 0.16);  // A5 sustain
                break;

            // cycle 117: 발견 체인 완료 — G major arpeggio (G5/B5/D6/G6).
            // victory(5음 C major) / levelUp(4음 C major)과 구분되는 G major 색채로
            // 체인 시스템(cycle 102/103)의 정체성을 가짐.
            case 'discovery_chain':
                this._playTone(783.99, 0.10, 0);     // G5
                this._playTone(987.77, 0.10, 0.10);  // B5
                this._playTone(1174.66, 0.10, 0.20); // D6
                this._playTone(1567.98, 0.30, 0.30); // G6 sustain
                break;

            // cycle 88: 도주 성공 — victory 5음 상승의 정반대인 짧은 하강 sine.
            // 후퇴 모먼트지만 안도감 / 위험 회피 성공이라 'error'(낮은 sawtooth) 와는
            // 다른 부드러운 톤. cycle 74-87 escape feedback chain의 마지막 sensory cue.
            case 'escape': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1100, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.18);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                osc.start(now);
                osc.stop(now + 0.18);
                break;
            }

            case 'explore': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.16);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
                osc.start(now);
                osc.stop(now + 0.16);
                break;
            }

            case 'victory':
                this._playTone(523.25, 0.1, 0);     // C5
                this._playTone(659.25, 0.1, 0.08);  // E5
                this._playTone(783.99, 0.1, 0.16);  // G5
                this._playTone(1046.50, 0.15, 0.24); // C6
                this._playTone(1318.51, 0.3, 0.36);  // E6
                break;

            // 전설 각인 드롭 및 anticipate 계열(boss hint / pity resonance)
            // victory보다 한 옥타브 위, C maj7 보이싱으로 cinematic shimmer
            case 'legendary':
                this._playTone(523.25, 0.09, 0);      // C5
                this._playTone(659.25, 0.09, 0.08);   // E5
                this._playTone(783.99, 0.09, 0.16);   // G5
                this._playTone(987.77, 0.11, 0.24);   // B5
                this._playTone(1046.50, 0.12, 0.34);  // C6
                this._playTone(1318.51, 0.42, 0.44);  // E6 sustain
                this._playTone(1975.53, 0.24, 0.44);  // B6 overlay shimmer
                break;

            default:
                break;
        }
    }

    _playTone(freq: any, dur: any, delay: any) {
        if (this.muted || !this.ctx) return;
        const { osc, gain } = this._createNodes();
        const startAt = this.ctx!.currentTime + delay;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startAt);
        gain.gain.setValueAtTime(0.05, startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
        osc.start(startAt);
        osc.stop(startAt + dur);
    }
}

export const soundManager = new SoundManager();
