/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  VolumeX, 
  BookOpen, 
  Timer, 
  Trophy, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Play,
  Award,
  ChevronRight,
  ShieldAlert,
  Gamepad2
} from 'lucide-react';

// ==========================================
// 1. SOUND GENERATOR (Web Audio API)
// ==========================================
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported in this browser', e);
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  private playOsc(type: OscillatorType, startFreq: number, endFreq: number, dur: number, vol = 0.15) {
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + dur);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  playJump() {
    this.playOsc('sine', 160, 440, 0.14, 0.12);
  }

  playCollect() {
    if (this.muted || !this.ctx) return;
    this.playOsc('triangle', 523.25, 1046.5, 0.1, 0.12); // C5 to C6
    setTimeout(() => {
      this.playOsc('sine', 659.25, 1318.5, 0.14, 0.1); // E5 to E6
    }, 60);
  }

  playDamage() {
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    // Buzzing explosion
    this.playOsc('sawtooth', 140, 50, 0.25, 0.18);
    
    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, 0.2);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    noise.start();
  }

  playCorrect() {
    if (this.muted || !this.ctx) return;
    this.playOsc('triangle', 440, 880, 0.15, 0.15); // A4 -> A5
    setTimeout(() => {
      this.playOsc('sine', 554, 1109, 0.25, 0.15); // C#5 -> C#6
    }, 90);
  }

  playWrong() {
    if (this.muted || !this.ctx) return;
    this.playOsc('sawtooth', 220, 110, 0.18, 0.15);
    setTimeout(() => {
      this.playOsc('sawtooth', 196, 98, 0.22, 0.15);
    }, 110);
  }

  playWin() {
    if (this.muted || !this.ctx) return;
    const song = [
      { f: 523.25, d: 130 }, // C5
      { f: 659.25, d: 130 }, // E5
      { f: 783.99, d: 130 }, // G5
      { f: 1046.50, d: 130 }, // C6
      { f: 1318.51, d: 180 }, // E6
      { f: 1567.98, d: 180 }, // G6
      { f: 2093.00, d: 400 }, // C7
    ];
    song.forEach((note, index) => {
      setTimeout(() => {
        this.playOsc('sine', note.f, note.f * 1.03, note.d / 1000, 0.12);
      }, index * 100);
    });
  }
}

const audio = new SoundEngine();

// ==========================================
// 2. TYPES & DATA DEF
// ==========================================
interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'grass' | 'steel' | 'gold' | 'magical';
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'trashcan' | 'toxic';
}

interface Book {
  id: number;
  x: number;
  y: number;
  collected: boolean;
  bobOffset: number;
}

interface Quiz {
  id: number;
  phaseId: number;
  triggerX: number;
  title: string;
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

const MATH_QUIZ_BANK: Quiz[] = [
  {
    id: 101,
    phaseId: 1,
    triggerX: 1000,
    title: "🧱 Jembatan Matematika Desa",
    question: "Ayu tiba di jembatan desa yang terputus! Untuk membantunya membentangkan jembatan ajaib, selesaikan hitungan ini: Berapa hasil dari 15 - 8 + 6?",
    options: ["11", "12", "13", "14"],
    correctIdx: 2, // 13
    explanation: "Hebat! Hitungannya: 15 - 8 = 7, lalu 7 + 6 = 13. Jembatan magis emas kini terbentang indah, silakan lanjutkan perjalanan Ayu menyeberang!"
  },
  {
    id: 102,
    phaseId: 1,
    triggerX: 1000,
    title: "🧱 Jembatan Matematika Desa",
    question: "Jembatan butuh kode matematika: Jika Pak Kades memiliki 4 kotak buku dan masing-masing berisi 6 buku, berapa total seluruh buku Pak Kades?",
    options: ["20 Buku", "24 Buku", "28 Buku", "30 Buku"],
    correctIdx: 1, // 24
    explanation: "Benar sekali! Perkalian dasarnya: 4 kotak x 6 buku = 24 buku. Jembatan ajaib langsung terpasang untuk Ayu!"
  },
  {
    id: 103,
    phaseId: 1,
    triggerX: 1000,
    title: "🧱 Jembatan Matematika Desa",
    question: "Selesaikan pola deret angka rahasia ini untuk mengaktifkan jembatan: 3, 6, 12, 24, ...?",
    options: ["30", "36", "48", "60"],
    correctIdx: 2, // 48
    explanation: "Mantap! Polanya dikali dua: 3x2=6, 6x2=12, 12x2=24, dan 24x2=48. Jembatan magis emas kini terpasang!"
  },
  {
    id: 104,
    phaseId: 1,
    triggerX: 1000,
    title: "🧱 Jembatan Matematika Desa",
    question: "Ayu harus membagi 30 pensil warna secara merata kepada 5 temannya di kelas. Berapa pensil yang diterima setiap anak?",
    options: ["5 Pensil", "6 Pensil", "7 Pensil", "8 Pensil"],
    correctIdx: 1, // 6
    explanation: "Luar biasa! 30 dibagi 5 sama dengan 6 pensil per anak. Jembatan emas langsung terbentang berkilau!"
  },
  {
    id: 105,
    phaseId: 1,
    triggerX: 1000,
    title: "🧱 Jembatan Matematika Desa",
    question: "Bantu Ayu melompat ke seberang dengan menghitung persamaan ini: 9 + (8 x 2) - 5 = ?",
    options: ["15", "20", "25", "29"],
    correctIdx: 1, // 20
    explanation: "Hebat! Dahulukan perkalian: 8 x 2 = 16. Kemudian 9 + 16 = 25, dan 25 - 5 = 20."
  },
  {
    id: 106,
    phaseId: 1,
    triggerX: 1000,
    title: "🧱 Jembatan Matematika Desa",
    question: "Bantuan Penyeberangan: Ibu Guru membeli 50 buku tulis. Ia membagikan 14 buku kepada murid, lalu membeli lagi 10 buku. Berapa buku Ibu Guru sekarang?",
    options: ["36 Buku", "42 Buku", "44 Buku", "46 Buku"],
    correctIdx: 3, // 46
    explanation: "Tepat sekali! Hitungannya: 50 - 14 = 36, lalu ditambah 10 menjadi 46 buku. Jembatan emas terbentang!"
  }
];

const SDG_QUIZ_BANK: Quiz[] = [
  {
    id: 201,
    phaseId: 2,
    triggerX: 3200,
    title: "⚡ Gerbang SDG 4 - Pendidikan Berkualitas",
    question: "Kamu sampai di pembatas energi gerbang kota. Menurut tujuan global SDG 4 (Pendidikan Berkualitas), setiap anak berhak mendapatkan pendidikan dasar secara...?",
    options: [
      "Sangat mahal dan terbatas",
      "Gratis, adil, dan berkualitas",
      "Hanya jika memiliki komputer canggih",
      "Hanya di akhir pekan saja"
    ],
    correctIdx: 1, // Gratis, adil, dan berkualitas
    explanation: "Luar biasa tepat! Core dari SDG 4 menjamin semua anak mendapatkan sekolah gratis, inklusif, dan berkualitas tanpa memandang latar belakang sosial mereka!"
  },
  {
    id: 202,
    phaseId: 2,
    triggerX: 3200,
    title: "⚡ Gerbang SDG 4 - Pendidikan Berkualitas",
    question: "Mengapa pendidikan anak perempuan sangat ditekankan dalam program pembangunan dunia inklusif SDG 4?",
    options: [
      "Hanya sebagai pemanis data",
      "Agar semua anak memiliki hak setara untuk belajar dan membangun masa depan",
      "Supaya tidak ada anak laki-laki yang boleh belajar",
      "Karena anak perempuan tidak suka main di luar rumah"
    ],
    correctIdx: 1, // Agar semua anak memiliki hak setara
    explanation: "Tepat! Kesetaraan gender dalam pendidikan adalah pilar SDG 4 agar semua memiliki kesempatan membangun masa depan yang lebih baik."
  },
  {
    id: 203,
    phaseId: 2,
    triggerX: 3200,
    title: "⚡ Gerbang SDG 4 - Pendidikan Berkualitas",
    question: "Tindakan apa yang paling mendukung terwujudnya sekolah inklusif yang ramah anak di sekitar kita?",
    options: [
      "Mengejek teman yang memiliki keterbatasan belajar",
      "Berteman dengan siapa saja tanpa membedakan latar belakang dan kondisi",
      "Hanya bermain bersama siswa yang pintar saja",
      "Merusak peralatan dan fasilitas perpustakaan umum"
    ],
    correctIdx: 1, // Berteman dengan siapa saja
    explanation: "Benar! Inklusivitas berarti merangkul semua orang dengan penuh empati, saling menghormati perbedaan, dan mendukung kesamaan hak belajar."
  },
  {
    id: 204,
    phaseId: 2,
    triggerX: 3200,
    title: "⚡ Gerbang SDG 4 - Pendidikan Berkualitas",
    question: "Apa fungsi utama dari tersedianya perpustakaan umum yang lengkap dan gratis di pemukiman warga menurut target SDG 4?",
    options: [
      "Sebagai ruang ber-AC untuk tidur siang gratis",
      "Meningkatkan literasi dan memberi akses belajar seumur hidup bagi semua warga",
      "Hanya sebagai tempat penyimpanan buku kuno berdebu",
      "Tempat berkumpul untuk bermain game online bersama"
    ],
    correctIdx: 1, // Meningkatkan literasi
    explanation: "Hebat! Akses ke perpustakaan gratis membantu mewujudkan pembelajaran sepanjang hayat (life-long learning) bagi seluruh masyarakat desa dan kota!"
  },
  {
    id: 205,
    phaseId: 2,
    triggerX: 3200,
    title: "⚡ Gerbang SDG 4 - Pendidikan Berkualitas",
    question: "Dalam menghadapi tantangan polusi kota menuju sekolah, apa salah satu contoh aksi nyata menjaga lingkungan yang sejalan dengan edukasi SDG?",
    options: [
      "Membuang sampah kemasan jajanan ke aliran sungai kota",
      "Berjalan kaki, bersepeda, atau menggunakan transportasi publik guna menekan emisi",
      "Membakar daun-daun kering di pekarangan setiap pagi",
      "Menebang pohon peneduh agar jalan raya terlihat luas"
    ],
    correctIdx: 1, // Berjalan kaki, bersepeda, dsb
    explanation: "Sangat cerdas! Mobilitas hijau seperti berjalan atau bersepeda mengurangi emisi berbahaya, melestarikan alam, dan mendukung kesehatan tubuh kita!"
  },
  {
    id: 206,
    phaseId: 2,
    triggerX: 3200,
    title: "⚡ Gerbang SDG 4 - Pendidikan Berkualitas",
    question: "Manakah yang merupakan pilar utama dari SDG 4 (Pendidikan Berkualitas) demi masa depan generasi penerus?",
    options: [
      "Guru yang galak dan bangunan gerbang sekolah yang megah",
      "Pendidikan yang adil, merata, inklusif, serta kesempatan belajar sepanjang hayat",
      "Membuat soal ujian sesulit mungkin agar banyak siswa tidak lulus",
      "Membatasi pendaftaran siswa agar hanya menerima anak orang kaya"
    ],
    correctIdx: 1, // Pendidikan yang adil, merata, inklusif
    explanation: "Tepat sekali! SDG 4 bertujuan menjamin kualitas pendidikan yang inklusif, adil, merata, dan mendorong pembelajaran sepanjang hayat."
  }
];

const QUIZZES: Quiz[] = [...MATH_QUIZ_BANK, ...SDG_QUIZ_BANK];

const shuffleArray = <T,>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
};

// ==========================================
// 3. MAIN COMPONENT
// ==========================================
export default function App() {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'QUIZ' | 'REPORT'>('START');
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [booksCollected, setBooksCollected] = useState<number>(0);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeMathQuiz, setActiveMathQuiz] = useState<Quiz>(MATH_QUIZ_BANK[0]);
  const [activeSdgQuiz, setActiveSdgQuiz] = useState<Quiz>(SDG_QUIZ_BANK[0]);

  const activeMathQuizRef = useRef<Quiz>(MATH_QUIZ_BANK[0]);
  const activeSdgQuizRef = useRef<Quiz>(SDG_QUIZ_BANK[0]);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [quizVerdict, setQuizVerdict] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [gameResult, setGameResult] = useState<'WIN' | 'GAMEOVER' | null>(null);

  // Canvas details
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);

  // Player physics state (ref-backed to bypass react stale closuring in requestAnimationFrame loop)
  const playerRef = useRef({
    x: 100,
    y: 350,
    vx: 0,
    vy: 0,
    w: 32,
    h: 46,
    grounded: false,
    facingLeft: false,
    damageCooldown: 0,
    animFrame: 0,
    animState: 'idle' as 'idle' | 'walk' | 'jump' | 'hurt',
  });

  // Game tracking coordinates
  const levelLength = 5500;
  const bridgeUnlockedRef = useRef<boolean>(false);
  const cityGateUnlockedRef = useRef<boolean>(false);
  const lastSecRef = useRef<number>(0);

  // Keyboard input state
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Elements definitions
  const platforms = useRef<Platform[]>([
    // PHASE 1: Rural Village Greenery (0 -> 2000)
    { x: 0, y: 440, w: 900, h: 100, type: 'grass' },
    // Bridge gap here at x = 900 to 1150
    { x: 1150, y: 440, w: 900, h: 100, type: 'grass' },
    // Phase 1 Floating Platforms
    { x: 250, y: 340, w: 120, h: 20, type: 'grass' },
    { x: 450, y: 260, w: 140, h: 20, type: 'grass' },
    { x: 700, y: 340, w: 120, h: 20, type: 'grass' },
    { x: 1300, y: 330, w: 150, h: 20, type: 'grass' },
    { x: 1550, y: 250, w: 150, h: 20, type: 'grass' },
    { x: 1800, y: 340, w: 120, h: 20, type: 'grass' },

    // PHASE 2: Heavy Smog Industrial City (2000 -> 4500)
    { x: 2050, y: 440, w: 1150, h: 100, type: 'steel' },
    // Gap/Gate division here at 3200 to 3450
    { x: 3450, y: 440, w: 1050, h: 100, type: 'steel' },
    // Phase 2 Floating Platforms (Steel Scaffolds)
    { x: 2200, y: 330, w: 140, h: 20, type: 'steel' },
    { x: 2450, y: 250, w: 140, h: 20, type: 'steel' },
    { x: 2700, y: 330, w: 140, h: 20, type: 'steel' },
    { x: 2950, y: 260, w: 140, h: 20, type: 'steel' },
    
    { x: 3700, y: 330, w: 140, h: 20, type: 'steel' },
    { x: 3950, y: 250, w: 140, h: 20, type: 'steel' },
    { x: 4200, y: 330, w: 140, h: 20, type: 'steel' },

    // PHASE 3: Bright Clear School Road (4500 -> End)
    { x: 4500, y: 440, w: 1200, h: 100, type: 'gold' },
    // Golden brick floaters
    { x: 4650, y: 340, w: 160, h: 20, type: 'gold' },
    { x: 4900, y: 260, w: 160, h: 20, type: 'gold' },
  ]);

  const obstacles = useRef<Obstacle[]>([
    // Phase 2 Obstacles
    { x: 2360, y: 408, w: 32, h: 32, type: 'trashcan' },
    { x: 2850, y: 408, w: 32, h: 32, type: 'trashcan' },
    // Toxic Sludges
    { x: 2750, y: 432, w: 90, h: 12, type: 'toxic' },
    { x: 3600, y: 432, w: 100, h: 12, type: 'toxic' },
    { x: 4050, y: 408, w: 32, h: 32, type: 'trashcan' },
    { x: 4150, y: 432, w: 120, h: 12, type: 'toxic' },
  ]);

  const books = useRef<Book[]>([
    { id: 1, x: 310, y: 270, collected: false, bobOffset: 0 },
    { id: 2, x: 520, y: 190, collected: false, bobOffset: Math.PI / 4 },
    { id: 3, x: 760, y: 270, collected: false, bobOffset: Math.PI / 2 },
    // Floating bridge reward
    { id: 4, x: 1025, y: 320, collected: false, bobOffset: Math.PI },
    { id: 5, x: 1380, y: 260, collected: false, bobOffset: Math.PI * 1.5 },
    { id: 6, x: 2270, y: 260, collected: false, bobOffset: 0 },
    { id: 7, x: 2770, y: 260, collected: false, bobOffset: Math.PI / 3 },
    { id: 8, x: 3300, y: 180, collected: false, bobOffset: Math.PI / 1.5 },
    { id: 9, x: 4020, y: 180, collected: false, bobOffset: Math.PI },
    { id: 10, x: 4980, y: 190, collected: false, bobOffset: Math.PI * 1.8 },
  ]);

  // Particle explosion for books/damage
  const particles = useRef<{x: number, y: number, vx: number, vy: number, color: string, alpha: number, size: number, life: number}[]>([]);

  // Trigger animations & checkpoint coordinates
  const checkpointX = useRef<number>(100);

  // Initialize and window controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;
      keysPressed.current[e.code] = true;
      
      // Auto-unlock AudioContext on first hit
      audio.init();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Timer countdown hook (runs only while in state 'PLAYING')
  useEffect(() => {
    let intervalId: any = null;
    if (gameState === 'PLAYING') {
      intervalId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            handleGameOver();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gameState]);

  // Trigger audio mute toggles on system
  const handleToggleMute = () => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  const handleStartGame = () => {
    audio.init();
    setScore(0);
    setTimeLeft(120);
    setBooksCollected(0);
    setGameResult(null);
    setActiveQuiz(null);
    setQuizVerdict(null);
    setSelectedAns(null);

    // Shuffle and pick new quizzes for Phase 1 & Phase 2
    const shuffledMath = shuffleArray(MATH_QUIZ_BANK);
    const shuffledSdg = shuffleArray(SDG_QUIZ_BANK);
    
    activeMathQuizRef.current = shuffledMath[0];
    activeSdgQuizRef.current = shuffledSdg[0];
    setActiveMathQuiz(shuffledMath[0]);
    setActiveSdgQuiz(shuffledSdg[0]);

    // Reset components refs
    bridgeUnlockedRef.current = false;
    cityGateUnlockedRef.current = false;
    checkpointX.current = 100;
    lastSecRef.current = 0;

    // Reset platforms to remove any dynamic magical platforms
    platforms.current = platforms.current.filter(plat => plat.type !== 'magical');

    // Reset Ayu
    playerRef.current = {
      x: 100,
      y: 350,
      vx: 0,
      vy: 0,
      w: 32,
      h: 46,
      grounded: false,
      facingLeft: false,
      damageCooldown: 0,
      animFrame: 0,
      animState: 'idle',
    };

    // Reset items collection
    books.current.forEach(b => b.collected = false);
    particles.current = [];

    setGameState('PLAYING');
  };

  const handleGameOver = () => {
    audio.playDamage();
    setGameResult('GAMEOVER');
    setGameState('REPORT');
  };

  const handleWin = () => {
    audio.playWin();
    setGameResult('WIN');
    setGameState('REPORT');
  };

  // Sparkle generator helper
  const addParticles = (x: number, y: number, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        color: color,
        alpha: 1,
        size: Math.random() * 4 + 2,
        life: 30 + Math.random() * 20,
      });
    }
  };

  // ----------------------------------------------------
  // PHYSICS & UPDATE LOOP
  // ----------------------------------------------------
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    let localFrame = 0;
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    const gameLoop = () => {
      if (!canvas || !ctx) {
        canvas = canvasRef.current;
        if (canvas) {
          ctx = canvas.getContext('2d');
        }
        if (!canvas || !ctx) {
          requestRef.current = requestAnimationFrame(gameLoop);
          return;
        }
      }

      localFrame++;
      const p = playerRef.current;

      // Increment animation frames
      p.animFrame++;

      // Handle damage frame flashes
      if (p.damageCooldown > 0) {
        p.damageCooldown--;
      }

      // Check checkpoints updates
      if (p.x > 1200 && checkpointX.current < 1200) {
        checkpointX.current = 1200;
      }
      if (p.x > 3500 && checkpointX.current < 3500) {
        checkpointX.current = 3500;
      }

      // Inputs Processing
      const isLeft = keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA'] || keysPressed.current['leftbtn'];
      const isRight = keysPressed.current['ArrowRight'] || keysPressed.current['KeyD'] || keysPressed.current['rightbtn'];
      const isJump = keysPressed.current['ArrowUp'] || keysPressed.current['KeyW'] || keysPressed.current['Space'] || keysPressed.current['upbtn'];

      // Left-Right Movement
      const speed = 4.2;
      const accel = 0.5;
      const friction = 0.85;

      if (isLeft) {
        p.vx -= accel;
        if (p.vx < -speed) p.vx = -speed;
        p.facingLeft = true;
        if (p.grounded) p.animState = 'walk';
      } else if (isRight) {
        p.vx += accel;
        if (p.vx > speed) p.vx = speed;
        p.facingLeft = false;
        if (p.grounded) p.animState = 'walk';
      } else {
        p.vx *= friction;
        if (Math.abs(p.vx) < 0.1) {
          p.vx = 0;
          if (p.grounded && p.animState !== 'hurt') p.animState = 'idle';
        }
      }

      // Jump Processing (Variable Height Jump mechanics)
      if (isJump && p.grounded) {
        p.vy = -10.5;
        p.grounded = false;
        p.animState = 'jump';
        audio.playJump();
        // Spawns dust particles
        addParticles(p.x + p.w / 2, p.y + p.h, '#e2e8f0', 5);
      } else if (isJump && p.vy < 0) {
        // Hold key to jump higher (gravitational adjustment)
        p.vy -= 0.16;
      }

      // Apply Gravity
      p.vy += 0.48;
      if (p.vy > 12) p.vy = 12; // Terminal velocity limit

      // Update positions
      p.x += p.vx;
      p.y += p.vy;

      // Bound clamp
      if (p.x < 5) {
        p.x = 5;
        p.vx = 0;
      }

      // Check Barriers & Trigger Quizzes
      const mathQuiz = activeMathQuizRef.current;
      const sdgQuiz = activeSdgQuizRef.current;

      // Math quiz lock at x = 1000
      if (!bridgeUnlockedRef.current && p.x > mathQuiz.triggerX - 40 && p.x < mathQuiz.triggerX) {
        p.x = mathQuiz.triggerX - 45;
        p.vx = 0;
        triggerQuiz(mathQuiz);
      }

      // SDG quiz lock at x = 3200
      if (!cityGateUnlockedRef.current && p.x > sdgQuiz.triggerX - 40 && p.x < sdgQuiz.triggerX) {
        p.x = sdgQuiz.triggerX - 45;
        p.vx = 0;
        triggerQuiz(sdgQuiz);
      }

      // Collision Resolution with Platforms
      p.grounded = false;

      // Fetch lock state for temporary/unlockable platforms
      const activePlatforms = platforms.current.filter(plat => {
        if (plat.type === 'magical') {
          return bridgeUnlockedRef.current;
        }
        return true;
      });

      // Simple efficient AABB resolve
      activePlatforms.forEach(plat => {
        // Vertical collision check
        if (p.x + p.w - 4 > plat.x && p.x + 4 < plat.x + plat.w) {
          // Landing on top
          if (p.vy >= 0 && p.y + p.h >= plat.y && p.y + p.h - p.vy <= plat.y + 12) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.grounded = true;
            if (p.animState === 'jump') p.animState = 'idle';
          }
          // Bumping from bottom
          else if (p.vy < 0 && p.y >= plat.y + plat.h - 8 && p.y - p.vy <= plat.y + plat.h) {
            p.y = plat.y + plat.h;
            p.vy = 0.5;
          }
        }
      });

      // Fallen off bottom check
      if (p.y > canvas.height + 40) {
        handleFallenOff();
      }

      // Damage contact resolution with Obstacles
      obstacles.current.forEach(obs => {
        if (p.damageCooldown === 0) {
          // Box-on-box bounds
          if (p.x + p.w - 6 > obs.x && p.x + 6 < obs.x + obs.w &&
              p.y + p.h > obs.y && p.y < obs.y + obs.h) {
            resolveDamage(obs);
          }
        }
      });

      // Book Collection check
      books.current.forEach(b => {
        if (!b.collected) {
          // Check collision with center of coin/book
          const bx = b.x + 12;
          const by = b.y + 12;
          const dist = Math.hypot((p.x + p.w/2) - bx, (p.y + p.h/2) - by);
          if (dist < 28) {
            b.collected = true;
            setBooksCollected(prev => {
              const next = prev + 1;
              setScore(s => s + 150);
              audio.playCollect();
              // Spawn cute sparkles
              addParticles(bx, by, '#ffd700', 12);
              return next;
            });
          }
        }
      });

      // Win Flag triggers check
      const flagGateX = 5100;
      if (p.x >= flagGateX) {
        handleWin();
        return;
      }

      // Camera chasing viewport bounds logic
      const targetCamX = p.x - canvas.width * 0.35;
      // Interpolate smooth scrolling camera bounding
      const camX = Math.max(0, Math.min(levelLength - canvas.width, targetCamX));

      // ----------------------------------------------------
      // DRAW OPERATIONS
      // ----------------------------------------------------
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // PARALLAX LAYER 0: Dynamic Sunrise/Morning sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#1a103c'); // Dark cosmos
      skyGrad.addColorStop(0.4, '#5c1d53'); // Crimson purple
      skyGrad.addColorStop(0.7, '#a2395b'); // Magenta rose
      skyGrad.addColorStop(1, '#e37c59'); // Soft honey sunrise
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw drifting clouds & pixel sun
      ctx.fillStyle = '#ffdf92';
      const sunY = 160 + Math.sin(localFrame * 0.005) * 10;
      ctx.beginPath();
      ctx.arc(800 - camX * 0.08, sunY, 45, 0, Math.PI * 2);
      ctx.fill();

      // Fluffy custom pixelated clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      const cloudsX = [150, 480, 850, 1300, 1750, 2300, 2900, 3600, 4300, 4800];
      cloudsX.forEach((cx, idx) => {
        const adjustedX = (cx - camX * 0.15 + (localFrame * 0.1)) % (levelLength * 0.4) + (idx * 20);
        ctx.fillRect(adjustedX, 60 + (idx % 3) * 20, 90 + (idx % 2) * 30, 24);
        ctx.fillRect(adjustedX + 15, 48 + (idx % 3) * 20, 50, 36);
      });

      // PARALLAX LAYER 1: Distant Scenery (village hills or factory chimney smoke)
      // Phase 1 Village Hills
      ctx.fillStyle = '#4f8065';
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 10) {
        const hillX = x + camX * 0.3;
        const hillY = 320 + Math.sin(hillX * 0.003) * 35 + Math.cos(hillX * 0.001) * 15;
        if (x === 0) ctx.moveTo(x, hillY);
        else ctx.lineTo(x, hillY);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.fill();

      // Phase 2 Industrial smokestack midgrounds
      if (camX > 1200) {
        ctx.fillStyle = 'rgba(45, 46, 60, 0.6)';
        const cityOffset = camX * 0.45;
        // Drawing factory and brick blocks chimneys
        for (let ix = 1500; ix < 4300; ix += 350) {
          const drawX = ix - cityOffset;
          // Chimney rect
          ctx.fillRect(drawX, 180, 40, 200);
          ctx.fillRect(drawX - 5, 170, 50, 15);
          // Dark toxic particles emitter
          if (localFrame % 22 === 0) {
            particles.current.push({
              x: drawX + 20 + cityOffset,
              y: 165 + Math.random() * 5,
              vx: -1.2 - Math.random() * 1.5,
              vy: -0.8 - Math.random() * 1,
              color: 'rgba(80, 80, 90, 0.45)',
              alpha: 0.9,
              size: 20 + Math.random() * 14,
              life: 140,
            });
          }
        }
      }

      // Draw floating bridges/gates structures in level space
      // Math Bridge (Ajaib flying bridge marker)
      const isQuiz1Solved = bridgeUnlockedRef.current;
      if (!isQuiz1Solved) {
        // Floating sparkly padlock sign
        ctx.fillStyle = '#fef08a'; // yellow background
        const floatSignY = 320 + Math.sin(localFrame * 0.07) * 6;
        ctx.fillRect(mathQuiz.triggerX - 60 - camX, floatSignY, 120, 50);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.strokeRect(mathQuiz.triggerX - 60 - camX, floatSignY, 120, 50);

        ctx.fillStyle = '#854d0e';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText("JEMBATAN TUTUP", mathQuiz.triggerX - 52 - camX, floatSignY + 20);
        ctx.font = '9px sans-serif';
        ctx.fillText("Selesaikan Kuis 🧱", mathQuiz.triggerX - 44 - camX, floatSignY + 38);
      }

      // City Gate energy barrier (SDG 4)
      const isQuiz2Solved = cityGateUnlockedRef.current;
      if (!isQuiz2Solved) {
        // Energy fence
        const glowPulse = Math.sin(localFrame * 0.15) * 0.2 + 0.65;
        const gateGrad = ctx.createLinearGradient(sdgQuiz.triggerX - camX, 100, sdgQuiz.triggerX + 20 - camX, 440);
        gateGrad.addColorStop(0, `rgba(239, 68, 68, ${glowPulse * 0.3})`);
        gateGrad.addColorStop(0.5, `rgba(239, 68, 68, ${glowPulse * 0.95})`);
        gateGrad.addColorStop(1, `rgba(239, 68, 68, ${glowPulse * 0.3})`);
        ctx.fillStyle = gateGrad;
        ctx.fillRect(sdgQuiz.triggerX - camX - 10, 80, 30, 360);

        // Posts
        ctx.fillStyle = '#222';
        ctx.fillRect(sdgQuiz.triggerX - camX - 15, 70, 40, 20);
        ctx.fillRect(sdgQuiz.triggerX - camX - 15, 420, 40, 20);

        // Locked aura tag
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(sdgQuiz.triggerX - 70 - camX, 200, 140, 44);
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(sdgQuiz.triggerX - 70 - camX, 200, 140, 44);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText("⚡ GERBANG TERKUNCI ⚡", sdgQuiz.triggerX - 64 - camX, 218);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText("Dekati & Jawab Trivia SDG 4", sdgQuiz.triggerX - 60 - camX, 234);
      }

      // FOREGROUND DRAWINGS (All level coordinates adjusted by camX)
      // Platforms rendering
      activePlatforms.forEach(plat => {
        const renderX = plat.x - camX;
        ctx.save();
        
        if (plat.type === 'grass') {
          // Lush earth
          ctx.fillStyle = '#5c3d2e'; // mud brown
          ctx.fillRect(renderX, plat.y, plat.w, plat.h);
          // grass top cover
          ctx.fillStyle = '#22c55e'; // green top
          ctx.fillRect(renderX, plat.y, plat.w, 14);
          ctx.fillStyle = '#16a34a'; // grass details dots
          for (let gx = 4; gx < plat.w; gx += 20) {
            ctx.fillRect(renderX + gx, plat.y + 14, 4, 6);
          }
        } 
        else if (plat.type === 'steel') {
          // Industrial metallic scaffolding
          ctx.fillStyle = '#334155'; // steel slate
          ctx.fillRect(renderX, plat.y, plat.w, plat.h);
          ctx.fillStyle = '#475569'; // steel details highlight
          ctx.fillRect(renderX + 2, plat.y + 2, plat.w - 4, 3);
          ctx.fillRect(renderX + 2, plat.y + 2, 3, plat.h - 4);
          // Drawing cross beams rivets
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(renderX, plat.y);
          ctx.lineTo(renderX + plat.w, plat.y + Math.min(plat.h, 20));
          ctx.stroke();
        } 
        else if (plat.type === 'gold') {
          // Bright royal path
          ctx.fillStyle = '#fbbf24'; // beautiful golden
          ctx.fillRect(renderX, plat.y, plat.w, plat.h);
          ctx.fillStyle = '#f59e0b'; // dark stripes
          // grid line drawings of school bricks path
          for (let bx = 0; bx < plat.w; bx += 18) {
            ctx.fillRect(renderX + bx, plat.y, 2, plat.h);
          }
          ctx.fillStyle = '#fffbeb'; // bright sun top line
          ctx.fillRect(renderX, plat.y, plat.w, 4);
        }
        else if (plat.type === 'magical') {
          // The bridge spanning across the gap (spawns when Q1 is solved)
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(renderX, plat.y, plat.w, plat.h);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(renderX, plat.y, plat.w, 3);
          // light particles emerging from magical bridge
          if (localFrame % 3 === 0) {
            particles.current.push({
              x: plat.x + Math.random() * plat.w,
              y: plat.y - 2,
              vx: (Math.random() - 0.5) * 1,
              vy: -0.4 - Math.random() * 0.8,
              color: '#fef08a',
              alpha: 0.9,
              size: 2 + Math.random() * 2,
              life: 25,
            });
          }
        }
        ctx.restore();
      });

      // Obstacles rendering (Phase 2 hazardous elements)
      obstacles.current.forEach(obs => {
        const rx = obs.x - camX;
        if (obs.type === 'trashcan') {
          // Steel gray rubbish can
          ctx.fillStyle = '#64748b';
          ctx.fillRect(rx, obs.y + 4, obs.w, obs.h - 4);
          ctx.fillStyle = '#cbd5e1'; // metal ribbing lines
          ctx.fillRect(rx + 4, obs.y + 6, 4, obs.h - 8);
          ctx.fillRect(rx + 14, obs.y + 6, 4, obs.h - 8);
          ctx.fillRect(rx + 24, obs.y + 6, 4, obs.h - 8);
          // Lid
          ctx.fillStyle = '#475569';
          ctx.fillRect(rx - 2, obs.y, obs.w + 4, 5);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(rx + obs.w/2 - 3, obs.y - 4, 6, 4); // lid handle
        } 
        else if (obs.type === 'toxic') {
          // Slumping toxic waste pool
          const wave = Math.sin(localFrame * 0.1) * 3 + 4;
          ctx.fillStyle = '#22c55e'; // glowing radioactive sludge green
          ctx.fillRect(rx, obs.y + 4 - wave/2, obs.w, obs.h + wave/2);
          ctx.fillStyle = '#4ade80'; // dynamic highlighted splashes
          ctx.fillRect(rx + Math.floor(localFrame * 0.5) % (obs.w - 10), obs.y + 2, 8, 4);
          // Green vapor particles bubbling
          if (localFrame % 8 === 0) {
            particles.current.push({
              x: obs.x + Math.random() * obs.w,
              y: obs.y,
              vx: (Math.random() - 0.5) * 0.8,
              vy: -0.6 - Math.random() * 1.2,
              color: '#34d399',
              alpha: 0.8,
              size: 3 + Math.random() * 3,
              life: 30,
            });
          }
        }
      });

      // Books (10 Books yellow items with animated sparkles)
      books.current.forEach(b => {
        if (!b.collected) {
          const rx = b.x - camX;
          const animBob = Math.sin(localFrame * 0.08 + b.bobOffset) * 6;
          const ry = b.y + animBob;
          ctx.save();
          
          // Outer magical glow aura circle
          const auraRad = 15 + Math.sin(localFrame * 0.1) * 3;
          const glowGrad = ctx.createRadialGradient(rx + 12, ry + 12, 2, rx + 12, ry + 12, auraRad);
          glowGrad.addColorStop(0, 'rgba(253, 224, 71, 0.5)');
          glowGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(rx + 12, ry + 12, auraRad, 0, Math.PI * 2);
          ctx.fill();

          // Golden Yellow Book Shape pixel layout
          ctx.fillStyle = '#eab308'; // Hard cover
          ctx.fillRect(rx + 4, ry + 2, 16, 20);

          // White sheets block
          ctx.fillStyle = '#fffdeb';
          ctx.fillRect(rx + 6, ry + 4, 14, 16);

          // Center Cover Book insignia (cute Red-White heart or symbol bookmark)
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(rx + 11, ry + 4, 3, 10); // ribbon

          // Hard spine
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(rx + 4, ry + 2, 3, 20);

          ctx.restore();
        }
      });

      // Particle system iteration & rendering
      particles.current.forEach((part, index) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life--;
        part.alpha = Math.max(0, part.life / 60);

        ctx.save();
        ctx.fillStyle = part.color;
        ctx.globalAlpha = part.alpha;
        ctx.fillRect(part.x - camX, part.y, part.size, part.size);
        ctx.restore();

        if (part.life <= 0) {
          particles.current.splice(index, 1);
        }
      });

      // SDN MANDIRI SDG 4 School Entrance Gate & Flags (Phase 3 ending x = 5100 to 5500)
      const gateBaseX = 5100;
      const rxGate = gateBaseX - camX;
      
      // Draw SDN Mandiri SDG 4 Gate Pillars
      ctx.fillStyle = '#e2e8f0'; // concrete archway
      // Left pillar
      ctx.fillRect(rxGate, 180, 50, 260);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(rxGate - 6, 420, 62, 20); // base block
      ctx.fillRect(rxGate, 320, 50, 15); // middle rib
      ctx.fillRect(rxGate - 4, 180, 58, 12); // pillar head

      // Right pillar
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(rxGate + 260, 180, 50, 260);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(rxGate + 254, 420, 62, 20);
      ctx.fillRect(rxGate + 260, 320, 50, 15);
      ctx.fillRect(rxGate + 256, 180, 58, 12);

      // Overarching concrete support beams
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(rxGate + 30, 155, 250, 35);
      ctx.fillStyle = '#475569';
      ctx.fillRect(rxGate + 40, 162, 230, 22);

      // School Gate signboard name: SDN Mandiri SDG 4
      ctx.fillStyle = '#fbbf24'; // beautiful golden frame
      ctx.fillRect(rxGate + 60, 195, 190, 42);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.strokeRect(rxGate + 60, 195, 190, 42);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "Fredoka"';
      ctx.fillText("SDN MANDIRI SDG 4", rxGate + 86, 214);
      ctx.font = 'bold 8px "Plus Jakarta Sans"';
      ctx.fillStyle = '#1e293b';
      ctx.fillText("🇮🇩 PENDIDIKAN BERKUALITAS UNTUK SEMUA 🇮🇩", rxGate + 68, 228);

      // Indonesian Waving Flags (Bendera Merah Putih) on poles!
      const flagPoles = [gateBaseX - 120, gateBaseX + 160, gateBaseX + 400];
      flagPoles.forEach((fx, fIdx) => {
        const rxPole = fx - camX;
        // Pole
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(rxPole, 180, 4, 260); // standard height
        ctx.fillStyle = '#ffd700'; // gold spear tip on top of pole
        ctx.beginPath();
        ctx.arc(rxPole + 2, 178, 4, 0, Math.PI * 2);
        ctx.fill();

        // Waving Flag mechanics
        const waviness = Math.sin(localFrame * 0.12 + fIdx * 8) * 4;
        ctx.fillStyle = '#ef4444'; // Red half
        ctx.beginPath();
        ctx.moveTo(rxPole + 4, 184);
        ctx.quadraticCurveTo(rxPole + 24, 184 + waviness, rxPole + 44, 184);
        ctx.lineTo(rxPole + 44, 202);
        ctx.quadraticCurveTo(rxPole + 24, 202 + waviness, rxPole + 4, 202);
        ctx.fill();

        ctx.fillStyle = '#ffffff'; // White half
        ctx.beginPath();
        ctx.moveTo(rxPole + 4, 202);
        ctx.quadraticCurveTo(rxPole + 24, 202 + waviness, rxPole + 44, 202);
        ctx.lineTo(rxPole + 44, 220);
        ctx.quadraticCurveTo(rxPole + 24, 220 + waviness, rxPole + 4, 220);
        ctx.fill();
      });

      // AYU CHARACTER RENDER (DYNAMIC PIXEL-ART CANVAS)
      // Drawn centered on her physics coordinates
      drawPixelAyu(ctx, p.x - camX + p.w / 2, p.y + p.h, p.facingLeft, p.animFrame, p.animState, p.damageCooldown);

      // Spawn subtle ground dust when walking
      if (p.animState === 'walk' && localFrame % 8 === 0) {
        addParticles(p.x + p.w / 2, p.y + p.h - 2, '#fffbeb', 2);
      }

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  // ----------------------------------------------------
  // PHYSICS COLLISION / ACTION PROCEDURES
  // ----------------------------------------------------
  const handleFallenOff = () => {
    const p = playerRef.current;
    p.damageCooldown = 60; // 1 sec immunity flashing
    p.animState = 'hurt';
    audio.playDamage();
    
    // deduct time penalty
    setTimeLeft(prev => {
      const penalty = Math.max(0, prev - 15);
      if (penalty === 0) handleGameOver();
      return penalty;
    });

    // Reset player position safely to current active checkpoint
    p.x = checkpointX.current;
    p.y = 200;
    p.vx = 0;
    p.vy = 0;
  };

  const resolveDamage = (obs: Obstacle) => {
    const p = playerRef.current;
    p.damageCooldown = 75; // frames of invulnerability immunity
    p.animState = 'hurt';
    p.vx = p.facingLeft ? 5.5 : -5.5; // knockback push away
    p.vy = -5.0; // small upward knock
    
    audio.playDamage();
    addParticles(p.x + p.w/2, p.y + p.h/2, '#ef4444', 15);

    // deduct 10 sec time penalty
    setTimeLeft(prev => {
      const penalty = Math.max(0, prev - 10);
      if (penalty === 0) handleGameOver();
      return penalty;
    });
  };

  const triggerQuiz = (quiz: Quiz) => {
    setGameState('QUIZ');
    setActiveQuiz(quiz);
    setSelectedAns(null);
    setQuizVerdict(null);
  };

  // Process Quiz submissions
  const handleAnswerQuiz = (choiceIdx: number) => {
    if (quizVerdict !== null) return; // single click lock
    setSelectedAns(choiceIdx);
    const isCorrect = choiceIdx === activeQuiz?.correctIdx;
    
    if (isCorrect) {
      setQuizVerdict('CORRECT');
      audio.playCorrect();
      setScore(s => s + 300); // 300 points bonus
    } else {
      setQuizVerdict('WRONG');
      audio.playWrong();
      setScore(s => Math.max(0, s - 100)); // take a small hit
      // time penalty of 15 seconds
      setTimeLeft(prev => Math.max(0, prev - 15));
    }
  };

  const handleCloseQuizAndContinue = () => {
    if (!activeQuiz) return;
    
    if (activeQuiz.phaseId === 1) {
      // Bridge solved
      bridgeUnlockedRef.current = true;
      // Transform platform type: replace locked math gaps with active bridge platforms safely
      const hasMagical = platforms.current.some(plat => plat.type === 'magical');
      if (!hasMagical) {
        platforms.current.push({
          x: 900,
          y: 440,
          w: 250,
          h: 100,
          type: 'magical'
        });
      }
      // Sparkle particles for complete bridge spans creation
      addParticles(1025, 430, '#ffd700', 35);
    } 
    else if (activeQuiz.phaseId === 2) {
      // City Gate solved
      cityGateUnlockedRef.current = true;
      addParticles(activeSdgQuizRef.current.triggerX, 260, '#34d399', 40);
    }

    // Reset modals overlays
    setActiveQuiz(null);
    setQuizVerdict(null);
    setSelectedAns(null);
    setGameState('PLAYING');
  };

  // ----------------------------------------------------
  // PIXEL ART AYU RENDERING ON CANVAS
  // ----------------------------------------------------
  const drawPixelAyu = (
    ctx: CanvasRenderingContext2D, 
    sx: number, 
    sy: number, 
    isFacingLeft: boolean, 
    animFrame: number, 
    animState: 'idle' | 'walk' | 'jump' | 'hurt',
    damageCooldown: number
  ) => {
    ctx.save();
    ctx.translate(sx, sy);
    if (isFacingLeft) {
      ctx.scale(-1, 1);
    }

    // Immunitic flash opacity
    if (damageCooldown > 0 && Math.floor(animFrame / 4) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    const pSize = 2; // Pixel pitch detail scaling multiplier

    // Secondary coordinates variables
    const walkSine = Math.sin(animFrame * 0.25);
    const breathingOffset = animState === 'idle' ? Math.sin(animFrame * 0.08) * 0.6 : 0;

    // Palette Definition
    const clrHood = '#9e003f';         // Maroon / Magenta-red cover
    const clrHoodDark = '#6b002a';     // Background shaded hood depth
    const clrRainbow = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6']; // orange, yellow, green, blue
    const clrHair = '#0d9488';         // Short teal / blue-green hair bangs
    const clrFace = '#fde047';         // Bright cute peach skin tone
    const clrSkirt = '#1e293b';        // Black rok skirt
    const clrBoot = '#7c2d12';         // Cokelat boot shoes

    // 1. Back cape (billowing backdrop layer)
    ctx.fillStyle = clrHoodDark;
    if (animState === 'jump') {
      ctx.fillRect(-8 * pSize, (-18 + breathingOffset) * pSize, 16 * pSize, 14 * pSize);
    } else {
      ctx.fillRect(-6 * pSize, (-16 + breathingOffset) * pSize, 12 * pSize, 12 * pSize);
    }

    // 2. Chibi Head cover outer hood hat shape
    ctx.fillStyle = clrHood;
    ctx.fillRect(-9 * pSize, (-36 + breathingOffset) * pSize, 18 * pSize, 16 * pSize);
    ctx.fillRect(-8 * pSize, (-37 + breathingOffset) * pSize, 16 * pSize, 18 * pSize);
    ctx.fillRect(-10 * pSize, (-34 + breathingOffset) * pSize, 20 * pSize, 12 * pSize);

    // 3. Rainbow inner lining detailing border inside face trim
    // Left/right strips
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = clrRainbow[c];
      ctx.fillRect((-7 + c) * pSize, (-30 + breathingOffset + c*0.5) * pSize, pSize, 10 * pSize);
      ctx.fillRect((6 - c) * pSize, (-30 + breathingOffset + c*0.5) * pSize, pSize, 10 * pSize);
    }

    // 4. Short Teal Hair Front bangs
    ctx.fillStyle = clrHair;
    ctx.fillRect(-6 * pSize, (-30 + breathingOffset) * pSize, 12 * pSize, 5 * pSize); // fringe
    ctx.fillRect(-7 * pSize, (-26 + breathingOffset) * pSize, 2 * pSize, 8 * pSize);  // left strands
    ctx.fillRect(5 * pSize, (-26 + breathingOffset) * pSize, 2 * pSize, 8 * pSize);  // right strands
    ctx.fillRect(-1 * pSize, (-27 + breathingOffset) * pSize, 2 * pSize, 3 * pSize);  // dangling center strand

    // 5. Face peach skin tone block
    ctx.fillStyle = clrFace;
    ctx.fillRect(-5 * pSize, (-25 + breathingOffset) * pSize, 10 * pSize, 9 * pSize);
    ctx.fillRect(-6 * pSize, (-23 + breathingOffset) * pSize, 12 * pSize, 5 * pSize);

    // 6. Determined tightly closed squinty eyes (Iconic chibi facial details)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';

    if (animState === 'hurt') {
      // Painful squint: X_X cross eyes
      ctx.strokeStyle = '#ef4444';
      // Left cross
      ctx.beginPath();
      ctx.moveTo(-4 * pSize, (-21 + breathingOffset) * pSize);
      ctx.lineTo(-2 * pSize, (-19 + breathingOffset) * pSize);
      ctx.moveTo(-2 * pSize, (-21 + breathingOffset) * pSize);
      ctx.lineTo(-4 * pSize, (-19 + breathingOffset) * pSize);
      // Right cross
      ctx.moveTo(2 * pSize, (-21 + breathingOffset) * pSize);
      ctx.lineTo(4 * pSize, (-19 + breathingOffset) * pSize);
      ctx.moveTo(4 * pSize, (-21 + breathingOffset) * pSize);
      ctx.lineTo(2 * pSize, (-19 + breathingOffset) * pSize);
      ctx.stroke();

      // Cry blush cheeks
      ctx.fillStyle = '#f87171';
      ctx.fillRect(-4.5 * pSize, (-16 + breathingOffset) * pSize, 2 * pSize, 1.2 * pSize);
      ctx.fillRect(2.5 * pSize, (-16 + breathingOffset) * pSize, 2 * pSize, 1.2 * pSize);
    } else {
      // Determined closed slanted slits (>_< style but confident)
      ctx.beginPath();
      // left determined close eye
      ctx.moveTo(-4.5 * pSize, (-20.5 + breathingOffset) * pSize);
      ctx.lineTo(-1.5 * pSize, (-20.5 + breathingOffset) * pSize);
      // right determined close eye
      ctx.moveTo(1.5 * pSize, (-20.5 + breathingOffset) * pSize);
      ctx.lineTo(4.5 * pSize, (-20.5 + breathingOffset) * pSize);
      ctx.stroke();

      // Confident blush cheek
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(-4.5 * pSize, (-17 + breathingOffset) * pSize, 2 * pSize, pSize);
      ctx.fillRect(2.5 * pSize, (-17 + breathingOffset) * pSize, 2 * pSize, pSize);
    }

    // Mouth
    ctx.fillStyle = '#7c2d12';
    if (animState === 'hurt') {
      ctx.fillRect(-1.5 * pSize, (-15 + breathingOffset) * pSize, 3 * pSize, 1.5 * pSize); // open shouting
    } else {
      ctx.fillRect(-1 * pSize, (-15.5 + breathingOffset) * pSize, 2 * pSize, 0.7 * pSize); // firm flat line
    }

    // 7. Cape Front body draping
    ctx.fillStyle = clrHood;
    ctx.fillRect(-8 * pSize, (-16 + breathingOffset) * pSize, 16 * pSize, 12 * pSize);
    ctx.fillRect(-9 * pSize, (-14 + breathingOffset) * pSize, 18 * pSize, 8 * pSize);

    // 8. Skirt
    ctx.fillStyle = clrSkirt;
    ctx.fillRect(-5 * pSize, (-4 + breathingOffset/2) * pSize, 10 * pSize, 4 * pSize);

    // 9. Tiny boots stepping walks
    ctx.fillStyle = clrBoot;
    if (animState === 'walk') {
      const offsetL = walkSine > 0 ? 1.5 : -1.5;
      const offsetR = walkSine > 0 ? -1.5 : 1.5;
      // left foot
      ctx.fillRect((-5 + offsetL) * pSize, 0, 3 * pSize, 3 * pSize);
      // right foot
      ctx.fillRect((2 + offsetR) * pSize, 0, 3 * pSize, 3 * pSize);
    } else if (animState === 'jump') {
      // feet lifted
      ctx.fillRect(-5 * pSize, 1 * pSize, 3 * pSize, 2.5 * pSize);
      ctx.fillRect(2 * pSize, 1 * pSize, 3 * pSize, 2.5 * pSize);
    } else {
      // Idle straight standing feet
      ctx.fillRect(-5 * pSize, 0, 3.5 * pSize, 3 * pSize);
      ctx.fillRect(1.5 * pSize, 0, 3.5 * pSize, 3 * pSize);
    }

    ctx.restore();
  };

  // Convert letter marks score
  const getLetterGrade = (finalScore: number, finalBooks: number) => {
    const total = finalScore + (finalBooks * 100);
    if (total >= 2200) return 'A+';
    if (total >= 1600) return 'A';
    if (total >= 1100) return 'B';
    return 'C';
  };

  return (
    <div 
      className="min-h-screen font-jakarta text-slate-100 flex flex-col items-center justify-center p-0 md:p-4 overflow-hidden relative selection:bg-[#C2185B] selection:text-white"
      style={{ background: 'linear-gradient(135deg, #FFD194 0%, #70E1F5 100%)' }}
    >
      {/* Decorative absolute backdrops mirroring morning clouds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.4),transparent)] pointer-events-none" />

      <main className="w-full max-w-5xl bg-slate-950/80 md:rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden relative flex flex-col">
        {/* Top Header / Bar */}
        <header className="px-5 py-4 bg-slate-950/90 border-b border-white/10 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#C2185B] via-[#E91E63] to-amber-400 flex items-center justify-center shadow-lg shadow-[#C2185B]/30">
              <span className="font-fredoka text-xl font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="font-fredoka text-lg md:text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-200 to-teal-200">
                Ayu's Quest for School
              </h1>
              <p className="text-[10px] md:text-xs text-slate-300 font-medium tracking-wide">
                Indonesian SDG 4 Educational Adventure Game
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Muted Indicator */}
            <button
              id="btn-mute"
              onClick={handleToggleMute}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition flex items-center gap-2 text-xs font-semibold text-white active:scale-95 cursor-pointer backdrop-blur"
              title="Toggle suara"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-[#C2185B]" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Suara Aktif'}</span>
            </button>
          </div>
        </header>

        {/* ----------------------------------------------------
            SCREEN 1: START COVER SCREEN
           ---------------------------------------------------- */}
        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              className="px-6 py-10 md:p-12 min-h-[500px] flex flex-col lg:flex-row items-center gap-10 bg-[radial-gradient(circle_at_center,rgba(194,24,91,0.1)_0%,transparent_100%)]"
            >
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C2185B]/20 border border-[#C2185B]/30 rounded-full text-xs font-extrabold text-amber-300 tracking-wide uppercase shadow-inner">
                  <Award className="w-3.5 h-3.5 text-[#C2185B]" />
                  SDG 4: Pendidikan Berkualitas
                </div>

                <h1 className="font-fredoka text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] text-white">
                  Ayu's Quest <br />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#C2185B] via-[#E91E63] to-amber-300 font-black">
                    for School
                  </span>
                </h1>

                <p className="text-sm md:text-base text-slate-200 leading-relaxed font-normal">
                  Raih impian sekolah bersama Ayu, si gadis kecil pixel art berkerudung merah marun! Bantu Ayu melewati rintangan jurang desa dengan kepintaran matematikamu, serta taklukkan polusi kabut hitam kota dengan pemahaman SDG 4 berkualitas.
                </p>

                {/* Cover controls how to play */}
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3 shadow-inner backdrop-blur-sm">
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-[#C2185B]" /> CARA BERMAIN:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-slate-300">
                    <div className="flex items-start gap-2">
                      <span className="flex-none px-1.5 py-0.5 bg-black/40 rounded font-mono text-white border border-white/10">A / D / ⬅ ➡</span>
                      <span>Bergerak Kiri / Kanan menyusuri jalur platform.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-none px-1.5 py-0.5 bg-black/40 rounded font-mono text-white border border-white/10">W / Space / ⬆</span>
                      <span>Melompat (Suhu jubah naik jika makin lama ditahan).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-none px-1.5 py-0.5 bg-yellow-400 text-black rounded font-black border border-yellow-500">Kuis 🧱</span>
                      <span>Selesaikan kuis untuk menyeberangi jembatan atau gerbang!</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex-none px-1.5 py-0.5 bg-[#C2185B] rounded text-white font-black border border-rose-900">Bahaya 🛢️</span>
                      <span>Hindari sampah & limbah hijau pereduksi sisa waktu!</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <button
                    id="btn-start"
                    onClick={handleStartGame}
                    className="group px-10 py-4 rounded-2xl bg-[#C2185B] text-white font-fredoka font-bold text-lg hover:bg-[#ad144f] border-b-4 border-[#880e4f] shadow-lg shadow-[#C2185B]/20 active:border-b-0 active:translate-y-[2px] active:mb-[2px] transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    MULAI PERJALANAN
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Ayu live preview animation box */}
              <div className="lg:w-80 flex flex-col items-center justify-center">
                <div className="relative w-72 h-72 rounded-3xl bg-black/40 border border-white/10 flex flex-col items-center justify-center overflow-hidden backdrop-blur">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,24,91,0.2)_0%,transparent_70%)]" />
                  
                  {/* Glowing platforms behind characters */}
                  <div className="absolute bottom-16 w-48 h-6 bg-gradient-to-r from-[#C2185B]/20 via-amber-400/30 to-teal-400/20 rounded-full blur-md animate-pulse" />
                  <div className="absolute bottom-18 w-36 h-2 bg-slate-800 rounded-full border border-slate-700" />
                  
                  {/* Animating mini preview SVG/Div floating code */}
                  <div className="mb-6 animate-[bounce_2s_infinite_ease-in-out]">
                    <div className="w-24 h-24 relative flex items-center justify-center">
                      {/* Live render via visual Canvas mockup inside cover */}
                      <canvas 
                        id="coverAyuCanvas"
                        width="80" 
                        height="90" 
                        className="pixel-corners w-20 h-24"
                        ref={(el) => {
                          if (!el) return;
                          const ctx = el.getContext('2d');
                          if (!ctx) return;
                          ctx.clearRect(0,0,80,90);
                          drawPixelAyu(ctx, 40,70, false, Math.floor(Date.now()/50), 'idle', 0);
                        }}
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <span className="font-fredoka text-amber-300 text-sm font-semibold tracking-wider">PREVIEW AYU (CHIBI)</span>
                    <div className="text-[10px] text-slate-300 max-w-[210px] mx-auto leading-relaxed">
                      Jubah Maroon • Tepian Pelangi ✨ • Rambut Teal • Ekspresi Tangguh
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ----------------------------------------------------
              SCREEN 2: PLAYING ACTIVE CANVAS SCREEN
             ---------------------------------------------------- */}
          {gameState === 'PLAYING' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex flex-col bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            >
              {/* HUD OVERLAY BOARD */}
              <div className="p-4 bg-slate-900/95 border-b border-white/10 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 text-xs font-bold select-none z-10">
                
                {/* Score Books Badge - High Density Gold Style */}
                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-400 to-amber-300 hover:rotate-1 text-slate-950 px-3.5 py-2 rounded-xl border-2 border-amber-500 shadow-md font-extrabold transition-transform">
                  <BookOpen className="w-4 h-4 text-[#C2185B] animate-bounce" />
                  <span>Buku: <span className="font-mono text-sm">{booksCollected}</span>/10</span>
                  <div className="w-[1.5px] h-3.5 bg-amber-600/60" />
                  <span>Score: <span className="font-mono text-sm text-[#C2185B]">{score}</span></span>
                </div>

                {/* Progress bar scale - Centered HUD element */}
                <div className="flex-1 min-w-[180px] flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-[#C2185B] font-black tracking-widest uppercase block">PROGRES PERJALANAN</span>
                  <div className="flex-1 bg-black/50 h-3.5 rounded-full border border-white/10 overflow-hidden relative">
                    {/* Checkpoints markings */}
                    <div className="absolute left-[20%] top-0 bottom-0 w-[2px] bg-white/20" title="Kuis 1" />
                    <div className="absolute left-[60%] top-0 bottom-0 w-[2px] bg-white/20" title="Kuis 2" />
                    <div className="absolute right-[8%] top-0 bottom-0 w-[2px] bg-emerald-500/50" title="SDN" />
                    
                    <div 
                      className="bg-gradient-to-r from-[#C2185B] via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-150"
                      style={{ width: `${Math.min(100, (playerRef.current.x / levelLength) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-amber-300 font-extrabold font-mono">{Math.floor(Math.min(100, (playerRef.current.x / levelLength) * 100))}%</span>
                </div>

                {/* Timer details - Vibrant Rose Accent Card */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                  timeLeft < 20 
                    ? 'bg-[#C2185B] border-[#C2185B] text-white animate-pulse' 
                    : 'bg-[#C2185B]/10 border-[#C2185B]/30 text-rose-300'
                }`}>
                  <Timer className={`w-4 h-4 ${timeLeft < 20 ? 'text-white animate-spin' : 'text-[#C2185B]'}`} />
                  <span>WAKTU: <span className="font-mono font-black text-sm">{timeLeft}s</span></span>
                </div>
              </div>

              {/* GAMEPLAY CANVAS CONTAINER */}
              <div className="relative w-full aspect-[16/8] md:aspect-[16/8] bg-slate-900 border-b border-white/10 overflow-hidden">
                <canvas
                  id="gameCanvas"
                  ref={canvasRef}
                  width="1024"
                  height="512"
                  className="w-full h-full block pixel-corners"
                />

                {/* Phase Title Dynamic Card Watermarks - Premium Glass Capsule style */}
                <div className="absolute bottom-4 left-4 px-4 py-2.5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 pointer-events-none select-none text-xs shadow-xl">
                  <span className="text-slate-400 mr-2 uppercase tracking-widest text-[9px] font-black">LOKASI SEKARANG:</span>
                  <span className="font-fredoka font-black text-white">
                    {playerRef.current.x < 2000 && " Desa Asri (Matematika)"}
                    {playerRef.current.x >= 2000 && playerRef.current.x < 4500 && " Kota Berpolusi (SDG 4 Trivia)"}
                    {playerRef.current.x >= 4500 && " Gerbang SDN Mandiri SDG 4!"}
                  </span>
                </div>

                {/* Visual control prompts */}
                <div className="absolute top-4 left-4 flex gap-1 pointer-events-none select-none">
                  <span className="px-2 py-0.5 text-[9px] font-black bg-black/50 rounded border border-white/10 text-slate-300 uppercase tracking-wider">A/D Bergerak</span>
                  <span className="px-2 py-0.5 text-[9px] font-black bg-black/50 rounded border border-white/10 text-slate-300 uppercase tracking-wider">Space Melompat</span>
                </div>
              </div>

              {/* MOBILE ON-SCREEN CONTROLLER TABS - High Density Tactile Console Style */}
              <div className="p-4 bg-slate-950 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
                {/* Left controls */}
                <div className="flex gap-3">
                  <button
                    onTouchStart={() => keysPressed.current['leftbtn'] = true}
                    onTouchEnd={() => keysPressed.current['leftbtn'] = false}
                    onMouseDown={() => keysPressed.current['leftbtn'] = true}
                    onMouseUp={() => keysPressed.current['leftbtn'] = false}
                    onMouseLeave={() => keysPressed.current['leftbtn'] = false}
                    className="flex-1 h-14 rounded-xl bg-[#795548] hover:bg-[#5D4037] text-white text-md font-bold font-mono transition-all border-b-4 border-[#3E2723] active:border-b-0 active:translate-y-1 cursor-pointer touch-none flex items-center justify-center gap-1 shadow-md"
                  >
                    ◀ GERAK KIRI (A)
                  </button>
                  <button
                    onTouchStart={() => keysPressed.current['rightbtn'] = true}
                    onTouchEnd={() => keysPressed.current['rightbtn'] = false}
                    onMouseDown={() => keysPressed.current['rightbtn'] = true}
                    onMouseUp={() => keysPressed.current['rightbtn'] = false}
                    onMouseLeave={() => keysPressed.current['rightbtn'] = false}
                    className="flex-1 h-14 rounded-xl bg-[#795548] hover:bg-[#5D4037] text-white text-md font-bold font-mono transition-all border-b-4 border-[#3E2723] active:border-b-0 active:translate-y-1 cursor-pointer touch-none flex items-center justify-center gap-1 shadow-md"
                  >
                    GERAK KANAN (D) ▶
                  </button>
                </div>

                {/* Right Jump triggers */}
                <button
                  onTouchStart={() => keysPressed.current['upbtn'] = true}
                  onTouchEnd={() => keysPressed.current['upbtn'] = false}
                  onMouseDown={() => keysPressed.current['upbtn'] = true}
                  onMouseUp={() => keysPressed.current['upbtn'] = false}
                  onMouseLeave={() => keysPressed.current['upbtn'] = false}
                  className="h-14 rounded-xl bg-[#C2185B] text-white text-md font-fredoka font-bold border-b-4 border-[#880e4f] hover:bg-[#ad144f] flex items-center justify-center gap-2 active:border-b-0 active:translate-y-1 transition-all cursor-pointer touch-none shadow-md"
                >
                  UP / LOMPAT (W / Space) 🚀
                </button>
              </div>
            </motion.div>
          )}

          {/* ----------------------------------------------------
              SCREEN 3: INTERACTIVE PAUSED DOM POP-UP QUIZ
             ---------------------------------------------------- */}
          {gameState === 'QUIZ' && activeQuiz && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 md:p-12 min-h-[500px] flex flex-col items-center justify-center relative bg-slate-950/75 backdrop-blur-md"
            >
              <div className="max-w-xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col border-4 border-[#C2185B] select-none text-slate-800 animate-[zoomIn_0.3s]">
                
                {/* Quiz header title banner */}
                <div className="bg-[#C2185B] p-5 text-center text-white relative">
                  <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-widest block mb-1">
                    TANTANGAN PERSIAPAN KELAS AYU
                  </span>
                  <h2 className="font-fredoka text-xl md:text-2xl font-black leading-tight uppercase tracking-tight">
                    {activeQuiz.title}
                  </h2>
                  <div className="absolute right-4 top-4 text-white/20">
                    <BookOpen className="w-7 h-7" />
                  </div>
                </div>

                <div className="p-6 md:p-8 flex flex-col gap-5">
                  {/* Question Section */}
                  <div className="text-sm md:text-base font-bold text-slate-800 leading-relaxed bg-[#C2185B]/5 p-5 rounded-2xl border-2 border-dashed border-[#C2185B]/25">
                    {activeQuiz.question}
                  </div>

                  {/* Multiple choices option maps */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-2">
                    {activeQuiz.options.map((opt, oIdx) => {
                      const isSelected = selectedAns === oIdx;
                      const isCorrectAnswer = oIdx === activeQuiz.correctIdx;
                      
                      let bgBorderClass = 'bg-white border-4 border-slate-200 text-slate-700 hover:border-[#C2185B] hover:text-slate-900 shadow-sm';
                      let iconElement = <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />;

                      if (selectedAns !== null) {
                        if (isSelected) {
                          if (isCorrectAnswer) {
                            bgBorderClass = 'bg-emerald-50 border-4 border-emerald-500 text-emerald-900 shadow-inner';
                            iconElement = <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
                          } else {
                            bgBorderClass = 'bg-rose-50 border-4 border-rose-500 text-rose-900 shadow-inner';
                            iconElement = <XCircle className="w-5 h-5 text-rose-600" />;
                          }
                        } else if (isCorrectAnswer) {
                          // Highlight true solution to player
                          bgBorderClass = 'bg-emerald-50/50 border-4 border-emerald-300 text-emerald-800';
                        } else {
                          bgBorderClass = 'bg-slate-50 border-4 border-slate-100 text-slate-400 opacity-50';
                        }
                      }

                      return (
                        <button
                          key={oIdx}
                          disabled={selectedAns !== null}
                          onClick={() => handleAnswerQuiz(oIdx)}
                          className={`group px-4 py-4 rounded-2xl text-left font-extrabold text-xs md:text-sm flex items-center justify-between gap-3 transition-all duration-150 ${bgBorderClass} ${selectedAns === null ? 'hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer' : ''}`}
                        >
                          <span>{opt}</span>
                          {iconElement}
                        </button>
                      );
                    })}
                  </div>

                  {/* Post quiz educational explanations segment */}
                  <AnimatePresence>
                    {quizVerdict !== null && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-5 rounded-2xl border-2 bg-slate-50 text-xs md:text-sm space-y-3 mt-2"
                        style={{ borderColor: quizVerdict === 'CORRECT' ? '#10b981' : '#f43f5e' }}
                      >
                        <div className="flex items-center gap-2">
                          {quizVerdict === 'CORRECT' ? (
                            <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-black tracking-wide text-[10px] uppercase border border-emerald-200">
                              JAWABAN BENAR (+300 Poin!) 🎉
                            </div>
                          ) : (
                            <div className="px-3 py-1 bg-rose-100 text-rose-800 rounded-lg font-black tracking-wide text-[10px] uppercase border border-rose-300">
                              JAWABAN KURANG TEPAT (-100 Poin) 😢
                            </div>
                          )}
                          {quizVerdict === 'WRONG' && (
                            <span className="text-[10px] text-rose-600 font-bold italic">Sisa waktu berkurang -15 detik!</span>
                          )}
                        </div>
                        
                        <p className="text-slate-600 leading-relaxed font-semibold">
                          {activeQuiz.explanation}
                        </p>

                        <div className="pt-2 border-t border-slate-200 flex justify-end">
                          <button
                            id="btn-quiz-next"
                            onClick={handleCloseQuizAndContinue}
                            className="px-5 py-3 rounded-xl bg-[#C2185B] text-white font-fredoka font-bold text-xs md:text-sm flex items-center gap-2 transition hover:bg-[#ad144f] border-b-4 border-[#880e4f] active:border-b-0 active:translate-y-[2px] cursor-pointer"
                          >
                            LANJUTKAN PERJALANAN
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Bottom console footer info */}
                <div className="bg-slate-50 p-4 text-center border-t border-slate-150 text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                  PILIH JAWABAN UNTUK MEMBUKA JALAN AYU 🌟
                </div>
              </div>
            </motion.div>
          )}

          {/* ----------------------------------------------------
              SCREEN 4: REPORT COVER CARD (Rapor Akhir)
             ---------------------------------------------------- */}
          {gameState === 'REPORT' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="p-6 md:p-12 min-h-[500px] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(194,24,91,0.06)_0%,transparent_100%)]"
            >
              <div className="max-w-xl w-full bg-white rounded-3xl border-4 border-[#C2185B] p-6 md:p-8 shadow-2xl relative flex flex-col gap-8 text-center text-slate-800">
                {/* Victory Sparkles background decoration */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.05)_0%,transparent_70%)] pointer-events-none" />

                {/* Scholastic frame header border banner */}
                <div className="space-y-2 relative">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
                    gameResult === 'WIN' ? 'bg-amber-100 border-2 border-amber-300 text-amber-500' : 'bg-rose-100 border-2 border-rose-300 text-[#C2185B]'
                  }`}>
                    {gameResult === 'WIN' ? <Trophy className="w-9 h-9 animate-bounce" /> : <ShieldAlert className="w-9 h-9" />}
                  </div>
                  
                  <span className="text-[10px] text-[#C2185B] font-extrabold tracking-widest block uppercase">
                    KEMENTERIAN PENDIDIKAN SDN MANDIRI SDG 4
                  </span>
                  <h2 className="font-fredoka text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                    {gameResult === 'WIN' ? '🏆 RAPOR KELULUSAN AYU' : '😢 COBA LAGI, AYU!'}
                  </h2>
                </div>

                {/* Core statistics board block */}
                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 grid grid-cols-2 gap-4 relative">
                  
                  {/* Ledger lines */}
                  <div className="absolute left-1/2 top-4 bottom-4 w-[2px] bg-slate-200" />

                  <div className="text-center space-y-1">
                    <span className="text-[10px] text-slate-500 font-extrabold tracking-wider block uppercase">Skor Nilai</span>
                    <span className="text-3xl font-mono font-black text-[#C2185B]">{score}</span>
                    <span className="text-[9px] text-slate-400 font-bold block">Kuis & Buku</span>
                  </div>

                  <div className="text-center space-y-1">
                    <span className="text-[10px] text-slate-500 font-extrabold tracking-wider block uppercase">Buku Terkumpul</span>
                    <span className="text-3xl font-mono font-black text-amber-500">{booksCollected} / 10</span>
                    <span className="text-[9px] text-slate-400 font-bold block">Sumbangan Pustaka</span>
                  </div>

                  <div className="col-span-2 border-t border-slate-200 pt-4 text-center mt-2 space-y-1">
                    <span className="text-[10px] text-slate-500 font-extrabold tracking-wider block uppercase">PREDIKAT RAPOR AKHIR</span>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-4xl font-fredoka font-black bg-clip-text text-transparent bg-gradient-to-r from-[#C2185B] to-amber-500">
                        {gameResult === 'WIN' ? getLetterGrade(score, booksCollected) : 'T/L'}
                      </span>
                      <span className="text-sm text-slate-700 font-black">
                        {gameResult === 'WIN' 
                          ? (score + booksCollected * 100 >= 1600 ? "Lulus Cum Laude! 🎓" : "Lulus Memuaskan! 🌸")
                          : "Tidak Lulus (Waktu Habis) 🧩"
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* SDG 4 / Education Quote reflection */}
                <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-100 text-slate-600 text-xs md:text-sm italic leading-relaxed font-semibold">
                  {gameResult === 'WIN' ? (
                    "\"Pendidikan adalah senjata paling mematikan di dunia, karena dengan itu kamu bisa mengubah dunia.\" - Nelson Mandela • Ayu berhasil berkat ketekunan melompat, menghindari kabut polusi dan menguraikan kuis pintar!"
                  ) : (
                    "\"Jangan pernah menyerah! Kegagalan hari ini adalah jembatan emas menuju kesuksesan hari esok.\" Sisa waktu habis sebelum Ayu sempat menginjakkan kaki di sekolah SDN Mandiri SDG 4. Ayo latih refleksmu dan jawab kuisnya secara presisi!"
                  )}
                </div>

                {/* Action CTA triggers */}
                <div className="flex flex-col sm:flex-row gap-4 items-stretch justify-center">
                  <button
                    id="btn-restart"
                    onClick={handleStartGame}
                    className="flex-1 px-8 py-4 rounded-xl bg-[#C2185B] text-white font-fredoka font-black hover:bg-[#ad144f] border-b-4 border-[#880e4f] shadow-md active:border-b-0 active:translate-y-[2px] active:mb-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                    {gameResult === 'WIN' ? 'MAIN LAGI / REPLAY' : 'COBA PERJALANAN BARU'}
                  </button>

                  <button
                    id="btn-back-menu"
                    onClick={() => setGameState('START')}
                    className="px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border-b-4 border-slate-300 active:border-b-0 active:translate-y-[2px] active:mb-[2px] font-fredoka font-bold transition-all cursor-pointer shadow-sm"
                  >
                    KEMBALI KE MENU UTAMA
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer legal credits */}
        <footer className="py-4 bg-slate-950/40 text-center border-t border-white/10 text-[10px] text-slate-300 select-none">
          <p>© 2026 Ayu's Quest for School. Mengakselerasi Pembangunan Pendidikan Inklusif & Adil (SDG Target 4).</p>
          <p className="mt-1 text-slate-400">Terinspirasi dari pixel art jubah maroon bergaris pelangi & rambut teal | Menggunakan Web Audio API Murni</p>
        </footer>
      </main>
    </div>
  );
}
