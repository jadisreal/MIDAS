/**
 * MIDAS Voice Assistant - Frontend Application
 * Dynamic frequency-reactive orb visualization
 */

// =============================================================================
// CONSTANTS
// =============================================================================
const STORAGE_KEY = 'midas_settings';
const HISTORY_KEY = 'midas_local_history';

const DEFAULT_SETTINGS = {
    inputDevice: '',
    outputDevice: '',
    soundEffects: true,
    voice: 'en_0',
    contextWindow: 4096,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 150,
    repeatPenalty: 1.1,
    beamSize: 1,
    vadFilter: true,
    vadThreshold: 300,
    sampleRate: 24000
};

// =============================================================================
// STATE
// =============================================================================
let settings = { ...DEFAULT_SETTINGS };
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isMuted = false;
let currentAudio = null;
let audioQueue = [];
let isPlaying = false;
let currentWebSocket = null;
let audioContext = null;
let analyser = null;
let conversationHistory = [];

// =============================================================================
// ELEMENTS
// =============================================================================
const $ = id => document.getElementById(id);
const statusIndicator = $('status-indicator');
const statusText = $('status-text');
const orbContainer = $('orbContainer');
const talkBtn = $('talkBtn');
const transcriptUser = $('transcriptUser');
const transcriptAssistant = $('transcriptAssistant');
const transcript = $('transcript');
const voiceSelect = $('voiceSelect');
const inputSelect = $('inputSelect');
const outputSelect = $('outputSelect');
const settingsBtn = $('settingsBtn');
const settingsModal = $('settingsModal');
const advancedModal = $('advancedModal');
const knowledgeModal = $('knowledgeModal');
const muteBtn = $('muteBtn');
const resetBtn = $('resetBtn');
const historyBtn = $('historyBtn');
const knowledgeBtn = $('knowledgeBtn');
const chatSidebar = $('chatSidebar');
const chatHistory = $('chatHistory');
const closeSidebar = $('closeSidebar');
const soundEffectsToggle = $('soundEffects');
const freqLabel = $('freqLabel');
const freqHz = $('freqHz');

// =============================================================================
// VISUALIZATION SYSTEM - MIDAS GOLDEN ORB
// =============================================================================
class OrbVisualization {
    constructor() {
        this.orbCanvas = $('orbCanvas');
        this.bgCanvas = $('orbBgCanvas');
        this.ringsCanvas = $('orbRingsCanvas');
        this.particlesCanvas = $('orbParticles');
        this.freqCanvas = $('freqCanvas');
        this.starsCanvas = $('starsCanvas');
        
        this.size = 400;  // Larger canvas for better detail
        this.center = this.size / 2;
        this.baseRadius = 90;
        
        // Setup all canvases
        [this.orbCanvas, this.bgCanvas, this.ringsCanvas, this.particlesCanvas].forEach(c => {
            c.width = this.size;
            c.height = this.size;
        });
        
        this.freqCanvas.width = 200;
        this.freqCanvas.height = 40;
        
        // Stars background
        this.starsCanvas.width = window.innerWidth;
        this.starsCanvas.height = window.innerHeight;
        
        // Contexts
        this.ctx = this.orbCanvas.getContext('2d');
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.ringsCtx = this.ringsCanvas.getContext('2d');
        this.particlesCtx = this.particlesCanvas.getContext('2d');
        this.freqCtx = this.freqCanvas.getContext('2d');
        this.starsCtx = this.starsCanvas.getContext('2d');
        
        // Audio data
        this.fftSize = 256;
        this.frequencyData = new Uint8Array(this.fftSize / 2);
        this.smoothedData = new Float32Array(this.fftSize / 2);
        this.waveformData = new Uint8Array(this.fftSize);
        
        // Frequency bands
        this.bass = 0;
        this.mid = 0;
        this.treble = 0;
        this.volume = 0;
        this.dominantFreq = 0;
        
        // Animation state
        this.phase = 0;
        this.isActive = false;
        this.isSpeaking = false;
        
        // Metallic gold color palette - LISTENING (deeper amber tones)
        this.colorsListening = {
            core: '#E8D5A3',          // Muted cream
            light: '#D4A84B',         // Deep amber
            primary: '#C4972A',       // Rich amber gold
            mid: '#A67C00',           // Dark amber
            deep: '#8B6914',          // Bronze shadow
            shadow: '#6B5010',        // Deep shadow
            dark: '#4A3810',          // Dark edge
        };
        
        // Metallic gold color palette - SPEAKING (bright radiant gold)
        this.colorsSpeaking = {
            core: '#FFFEF0',          // Bright white-gold
            light: '#FFE566',         // Brilliant gold
            primary: '#FFD700',       // Pure gold
            mid: '#F0C030',           // Warm gold
            deep: '#DAA520',          // Goldenrod
            shadow: '#B8860B',        // Deep gold
            dark: '#8B6914',          // Edge shadow
        };
        
        // Specular highlight positions (simulated light reflections)
        this.highlights = [
            { x: -0.35, y: -0.35, size: 0.3, intensity: 0.9 },
            { x: 0.15, y: -0.25, size: 0.15, intensity: 0.5 },
            { x: 0.4, y: 0.3, size: 0.08, intensity: 0.3 },
        ];
        
        // Floating dust particles
        this.dustParticles = [];
        this.initDustParticles(40);
        
        // Stars - reduced count
        this.stars = [];
        this.initStars(80);
        
        // Light angle animation
        this.lightAngle = 0;
        
        // Start animation
        this.animate();
        this.animateStars();
        
        // Handle resize - debounced
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.starsCanvas.width = window.innerWidth;
                this.starsCanvas.height = window.innerHeight;
                this.initStars(80);
            }, 200);
        });
    }
    
    initDustParticles(count) {
        this.dustParticles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 0.7 + Math.random() * 0.8;
            this.dustParticles.push({
                angle: angle,
                dist: dist,
                size: 0.5 + Math.random() * 1.5,
                speed: 0.001 + Math.random() * 0.003,
                phase: Math.random() * Math.PI * 2,
                brightness: 0.3 + Math.random() * 0.7,
                orbitRadius: this.baseRadius * dist
            });
        }
    }
    
    initStars(count) {
        this.stars = [];
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random() * this.starsCanvas.width,
                y: Math.random() * this.starsCanvas.height,
                size: Math.random() * 1.5,
                twinkleSpeed: 0.01 + Math.random() * 0.02,
                twinkleOffset: Math.random() * Math.PI * 2,
                opacity: 0.3 + Math.random() * 0.7
            });
        }
    }
    
    setAudioData(frequencyData, waveformData) {
        if (frequencyData) {
            this.frequencyData = frequencyData;
            
            // Smooth the data
            for (let i = 0; i < frequencyData.length; i++) {
                this.smoothedData[i] += (frequencyData[i] - this.smoothedData[i]) * 0.2;
            }
            
            // Calculate frequency bands
            const third = Math.floor(frequencyData.length / 3);
            let bassSum = 0, midSum = 0, trebleSum = 0;
            
            for (let i = 0; i < third; i++) bassSum += this.smoothedData[i];
            for (let i = third; i < third * 2; i++) midSum += this.smoothedData[i];
            for (let i = third * 2; i < frequencyData.length; i++) trebleSum += this.smoothedData[i];
            
            this.bass = bassSum / third / 255;
            this.mid = midSum / third / 255;
            this.treble = trebleSum / third / 255;
            this.volume = (this.bass + this.mid + this.treble) / 3;
            
            // Find dominant frequency
            let maxVal = 0, maxIdx = 0;
            for (let i = 0; i < frequencyData.length; i++) {
                if (this.smoothedData[i] > maxVal) {
                    maxVal = this.smoothedData[i];
                    maxIdx = i;
                }
            }
            this.dominantFreq = Math.round((maxIdx / frequencyData.length) * 22050);
        }
        
        if (waveformData) {
            this.waveformData = waveformData;
        }
    }
    
    setActive(active) {
        this.isActive = active;
        orbContainer.classList.toggle('active', active);
        statusIndicator.classList.toggle('listening', active);
        freqLabel.classList.toggle('active', active);
        freqLabel.textContent = active ? 'LISTENING' : 'IDLE';
    }
    
    setSpeaking(speaking) {
        this.isSpeaking = speaking;
        orbContainer.classList.toggle('speaking', speaking);
        statusIndicator.classList.toggle('speaking', speaking);
        if (speaking) {
            freqLabel.textContent = 'SPEAKING';
            freqLabel.classList.add('active');
        } else if (!this.isActive) {
            freqLabel.textContent = 'IDLE';
            freqLabel.classList.remove('active');
        }
    }
    
    animateStars() {
        const ctx = this.starsCtx;
        ctx.clearRect(0, 0, this.starsCanvas.width, this.starsCanvas.height);
        
        const time = Date.now() * 0.001;
        
        this.stars.forEach(star => {
            const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
            const opacity = star.opacity * (0.5 + twinkle * 0.5);
            
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fill();
        });
        
        setTimeout(() => this.animateStars(), 50);
    }
    
    animate() {
        this.phase += 0.012;
        this.lightAngle += 0.003;
        
        // Clear all canvases
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.bgCtx.clearRect(0, 0, this.size, this.size);
        this.ringsCtx.clearRect(0, 0, this.size, this.size);
        this.particlesCtx.clearRect(0, 0, this.size, this.size);
        this.freqCtx.clearRect(0, 0, this.freqCanvas.width, this.freqCanvas.height);
        
        // Draw layers
        this.drawAmbientGlow();
        this.drawOrbitalRings();
        this.drawMetallicOrb();
        this.drawDustParticles();
        this.drawFrequencyBars();
        this.updateFreqDisplay();
        
        requestAnimationFrame(() => this.animate());
    }
    
    drawAmbientGlow() {
        const ctx = this.bgCtx;
        const active = this.isActive || this.isSpeaking;
        
        // Outer ambient glow - more subtle
        const glowRadius = this.baseRadius * 1.8;
        const gradient = ctx.createRadialGradient(
            this.center, this.center, this.baseRadius * 0.6,
            this.center, this.center, glowRadius
        );
        
        if (this.isSpeaking) {
            // Speaking: brighter gold glow
            const intensity = 0.2 + this.volume * 0.15;
            gradient.addColorStop(0, `rgba(255, 215, 0, ${intensity * 0.5})`);
            gradient.addColorStop(0.4, `rgba(218, 165, 32, ${intensity * 0.25})`);
            gradient.addColorStop(0.7, `rgba(184, 134, 11, ${intensity * 0.1})`);
            gradient.addColorStop(1, 'transparent');
        } else if (this.isActive) {
            // Listening: darker amber glow
            const intensity = 0.15 + this.volume * 0.1;
            gradient.addColorStop(0, `rgba(184, 134, 11, ${intensity * 0.4})`);
            gradient.addColorStop(0.4, `rgba(139, 105, 20, ${intensity * 0.2})`);
            gradient.addColorStop(0.7, `rgba(107, 80, 16, ${intensity * 0.1})`);
            gradient.addColorStop(1, 'transparent');
        } else {
            // Idle: very subtle
            gradient.addColorStop(0, 'rgba(60, 60, 70, 0.05)');
            gradient.addColorStop(1, 'transparent');
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.size, this.size);
        
        // Very subtle golden haze when speaking
        if (this.isSpeaking) {
            const haze = ctx.createRadialGradient(
                this.center, this.center, 0,
                this.center, this.center, this.baseRadius * 1.3
            );
            haze.addColorStop(0, `rgba(255, 248, 220, ${0.08 + this.volume * 0.05})`);
            haze.addColorStop(0.5, `rgba(255, 215, 0, ${0.04 + this.volume * 0.03})`);
            haze.addColorStop(1, 'transparent');
            ctx.fillStyle = haze;
            ctx.fillRect(0, 0, this.size, this.size);
        }
    }
    
    drawOrbitalRings() {
        const ctx = this.ringsCtx;
        const active = this.isActive || this.isSpeaking;
        
        // Draw 3 orbital rings at different angles
        const rings = [
            { radius: this.baseRadius * 1.4, tilt: 0.2, rotation: this.phase * 0.5, width: 1 },
            { radius: this.baseRadius * 1.6, tilt: -0.15, rotation: -this.phase * 0.3, width: 0.8 },
            { radius: this.baseRadius * 1.85, tilt: 0.1, rotation: this.phase * 0.2, width: 0.6 },
        ];
        
        // Different ring colors for listening vs speaking
        const ringColor = this.isSpeaking 
            ? { r: 255, g: 215, b: 0 }    // Bright gold
            : { r: 184, g: 134, b: 11 };  // Darker amber
        
        rings.forEach((ring, idx) => {
            const bandValue = idx === 0 ? this.bass : idx === 1 ? this.mid : this.treble;
            const dynamicRadius = ring.radius + (active ? bandValue * 12 : 0);
            const opacity = active ? (this.isSpeaking ? 0.25 : 0.2) + bandValue * 0.3 : 0.08;
            
            ctx.save();
            ctx.translate(this.center, this.center);
            ctx.rotate(ring.rotation);
            ctx.scale(1, 0.3 + ring.tilt);  // Create ellipse effect
            
            // Main ring
            ctx.beginPath();
            ctx.arc(0, 0, dynamicRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${ringColor.r}, ${ringColor.g}, ${ringColor.b}, ${opacity})`;
            ctx.lineWidth = ring.width;
            ctx.stroke();
            
            // Ring glow (subtle)
            if (active) {
                ctx.beginPath();
                ctx.arc(0, 0, dynamicRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${ringColor.r}, ${ringColor.g}, ${ringColor.b}, ${opacity * 0.2})`;
                ctx.lineWidth = ring.width * 3;
                ctx.stroke();
            }
            
            ctx.restore();
        });
    }
    
    drawMetallicOrb() {
        const ctx = this.ctx;
        const active = this.isActive || this.isSpeaking;
        
        // Select color palette based on state
        const colors = this.isSpeaking ? this.colorsSpeaking : this.colorsListening;
        
        // Calculate dynamic radius based on audio
        const breathe = Math.sin(this.phase * 0.5) * 3;
        const bassExpand = active ? this.bass * 12 : 0;
        const currentRadius = this.baseRadius + breathe + bassExpand;
        
        // Create clipping path for the orb
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.center, this.center, currentRadius, 0, Math.PI * 2);
        ctx.clip();
        
        // === LAYER 1: Base metallic gradient ===
        const baseGradient = ctx.createRadialGradient(
            this.center - currentRadius * 0.4,
            this.center - currentRadius * 0.4,
            0,
            this.center,
            this.center,
            currentRadius * 1.2
        );
        
        if (active) {
            baseGradient.addColorStop(0, colors.core);
            baseGradient.addColorStop(0.1, colors.light);
            baseGradient.addColorStop(0.3, colors.primary);
            baseGradient.addColorStop(0.5, colors.mid);
            baseGradient.addColorStop(0.7, colors.deep);
            baseGradient.addColorStop(0.9, colors.shadow);
            baseGradient.addColorStop(1, colors.dark);
        } else {
            // Dormant state - darker, more muted
            baseGradient.addColorStop(0, '#4A4A52');
            baseGradient.addColorStop(0.3, '#3A3A42');
            baseGradient.addColorStop(0.6, '#2A2A32');
            baseGradient.addColorStop(1, '#1A1A22');
        }
        
        ctx.fillStyle = baseGradient;
        ctx.fillRect(0, 0, this.size, this.size);
        
        // === LAYER 2: Metallic sheen overlay ===
        if (active) {
            const sheenAngle = this.lightAngle;
            const sheenX = this.center + Math.cos(sheenAngle) * currentRadius * 0.3;
            const sheenY = this.center + Math.sin(sheenAngle) * currentRadius * 0.3;
            
            const sheenIntensity = this.isSpeaking ? 0.35 : 0.2;
            const sheen = ctx.createRadialGradient(
                sheenX, sheenY, 0,
                sheenX, sheenY, currentRadius * 0.8
            );
            sheen.addColorStop(0, `rgba(255, 250, 230, ${sheenIntensity + this.volume * 0.15})`);
            sheen.addColorStop(0.3, `rgba(255, 223, 128, ${sheenIntensity * 0.5 + this.volume * 0.1})`);
            sheen.addColorStop(1, 'transparent');
            
            ctx.fillStyle = sheen;
            ctx.fillRect(0, 0, this.size, this.size);
        }
        
        // === LAYER 3: Specular highlights ===
        this.highlights.forEach((h, i) => {
            const hx = this.center + h.x * currentRadius;
            const hy = this.center + h.y * currentRadius;
            const hSize = h.size * currentRadius;
            
            const highlight = ctx.createRadialGradient(hx, hy, 0, hx, hy, hSize);
            const intensity = active ? h.intensity * (0.8 + this.volume * 0.4) : h.intensity * 0.2;
            
            if (active) {
                highlight.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
                highlight.addColorStop(0.3, `rgba(255, 250, 220, ${intensity * 0.6})`);
                highlight.addColorStop(1, 'transparent');
            } else {
                highlight.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.3})`);
                highlight.addColorStop(1, 'transparent');
            }
            
            ctx.fillStyle = highlight;
            ctx.fillRect(0, 0, this.size, this.size);
        });
        
        // === LAYER 4: Inner depth shadow ===
        const innerShadow = ctx.createRadialGradient(
            this.center + currentRadius * 0.2,
            this.center + currentRadius * 0.2,
            currentRadius * 0.5,
            this.center,
            this.center,
            currentRadius
        );
        innerShadow.addColorStop(0, 'transparent');
        innerShadow.addColorStop(0.7, `rgba(92, 72, 39, ${active ? 0.2 : 0.4})`);
        innerShadow.addColorStop(1, `rgba(20, 15, 5, ${active ? 0.4 : 0.6})`);
        
        ctx.fillStyle = innerShadow;
        ctx.fillRect(0, 0, this.size, this.size);
        
        // === LAYER 5: Audio-reactive surface ripples ===
        if (active && this.volume > 0.05) {
            ctx.globalCompositeOperation = 'overlay';
            
            const rippleCount = 5;
            for (let i = 0; i < rippleCount; i++) {
                const ripplePhase = this.phase * 2 + i * (Math.PI * 2 / rippleCount);
                const rippleRadius = currentRadius * (0.3 + (i / rippleCount) * 0.6);
                const rippleIntensity = this.smoothedData[i * 20] / 255 || 0;
                
                const ripple = ctx.createRadialGradient(
                    this.center, this.center, rippleRadius - 5,
                    this.center, this.center, rippleRadius + 5
                );
                
                const opacity = rippleIntensity * 0.15 * Math.sin(ripplePhase);
                ripple.addColorStop(0, 'transparent');
                ripple.addColorStop(0.5, `rgba(255, 215, 0, ${Math.abs(opacity)})`);
                ripple.addColorStop(1, 'transparent');
                
                ctx.fillStyle = ripple;
                ctx.fillRect(0, 0, this.size, this.size);
            }
            
            ctx.globalCompositeOperation = 'source-over';
        }
        
        ctx.restore();
        
        // === LAYER 6: Outer rim / edge highlight ===
        ctx.beginPath();
        ctx.arc(this.center, this.center, currentRadius, 0, Math.PI * 2);
        
        // Create gradient stroke for 3D edge effect
        const rimGradient = ctx.createLinearGradient(
            this.center - currentRadius, this.center - currentRadius,
            this.center + currentRadius, this.center + currentRadius
        );
        
        if (active) {
            rimGradient.addColorStop(0, `rgba(255, 250, 220, ${0.8 + this.volume * 0.2})`);
            rimGradient.addColorStop(0.3, `rgba(255, 215, 0, ${0.5 + this.volume * 0.2})`);
            rimGradient.addColorStop(0.7, `rgba(184, 134, 11, 0.4)`);
            rimGradient.addColorStop(1, `rgba(92, 72, 39, 0.3)`);
        } else {
            rimGradient.addColorStop(0, 'rgba(80, 80, 90, 0.3)');
            rimGradient.addColorStop(1, 'rgba(40, 40, 50, 0.2)');
        }
        
        ctx.strokeStyle = rimGradient;
        ctx.lineWidth = active ? 2 : 1;
        ctx.stroke();
        
        // Add outer glow ring when active
        if (active) {
            ctx.beginPath();
            ctx.arc(this.center, this.center, currentRadius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 215, 0, ${0.15 + this.volume * 0.2})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }
    }
    
    drawDustParticles() {
        const ctx = this.particlesCtx;
        const active = this.isActive || this.isSpeaking;
        
        this.dustParticles.forEach((p, i) => {
            // Update particle position
            p.angle += p.speed * (active ? 1 + this.volume * 3 : 0.5);
            
            // Audio reactivity
            const freqIdx = Math.floor((i / this.dustParticles.length) * this.smoothedData.length);
            const freqValue = this.smoothedData[freqIdx] / 255 || 0;
            
            // Floating motion
            const float = Math.sin(this.phase * 2 + p.phase) * 8;
            const orbitPulse = active ? freqValue * 25 : 0;
            
            const currentDist = p.orbitRadius + float + orbitPulse;
            const x = this.center + Math.cos(p.angle) * currentDist;
            const y = this.center + Math.sin(p.angle) * currentDist;
            
            // Draw glowing particle
            const particleSize = p.size * (active ? 1 + freqValue : 0.7);
            const opacity = p.brightness * (active ? 0.6 + freqValue * 0.4 : 0.2);
            
            // Particle glow
            const glow = ctx.createRadialGradient(x, y, 0, x, y, particleSize * 3);
            glow.addColorStop(0, active 
                ? `rgba(255, 215, 0, ${opacity})` 
                : `rgba(100, 100, 110, ${opacity * 0.5})`);
            glow.addColorStop(0.5, active 
                ? `rgba(218, 165, 32, ${opacity * 0.3})` 
                : `rgba(60, 60, 70, ${opacity * 0.2})`);
            glow.addColorStop(1, 'transparent');
            
            ctx.fillStyle = glow;
            ctx.fillRect(x - particleSize * 3, y - particleSize * 3, particleSize * 6, particleSize * 6);
            
            // Core
            ctx.beginPath();
            ctx.arc(x, y, particleSize, 0, Math.PI * 2);
            ctx.fillStyle = active 
                ? `rgba(255, 250, 220, ${opacity * 1.2})`
                : `rgba(150, 150, 160, ${opacity * 0.5})`;
            ctx.fill();
        });
    }
    
    drawFrequencyBars() {
        const ctx = this.freqCtx;
        const width = this.freqCanvas.width;
        const height = this.freqCanvas.height;
        const active = this.isActive || this.isSpeaking;
        
        const barCount = 32;
        const barWidth = (width / barCount) - 2;
        const maxHeight = height - 8;
        
        for (let i = 0; i < barCount; i++) {
            const freqIdx = Math.floor((i / barCount) * this.smoothedData.length);
            const value = active ? this.smoothedData[freqIdx] / 255 : 0.05 + Math.sin(this.phase + i * 0.2) * 0.03;
            const barHeight = Math.max(2, value * maxHeight);
            
            const x = i * (barWidth + 2) + 1;
            const y = (height - barHeight) / 2;
            
            // Gradient for each bar
            const gradient = ctx.createLinearGradient(0, y + barHeight, 0, y);
            const opacity = active ? 0.4 + value * 0.6 : 0.15;
            gradient.addColorStop(0, `rgba(184, 134, 11, ${opacity * 0.4})`);
            gradient.addColorStop(0.5, `rgba(218, 165, 32, ${opacity * 0.7})`);
            gradient.addColorStop(1, `rgba(255, 215, 0, ${opacity})`);
            
            ctx.fillStyle = gradient;
            
            // Rounded bars
            const radius = barWidth / 2;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, radius);
            ctx.fill();
        }
    }
    
    updateFreqDisplay() {
        if (this.isActive || this.isSpeaking) {
            freqHz.textContent = this.dominantFreq > 0 ? `${this.dominantFreq} Hz` : '—';
        } else {
            freqHz.textContent = '—';
        }
    }
}

let visualization;

// =============================================================================
// AUDIO ANALYSIS
// =============================================================================
let micAnalyser = null;
let playbackAnalyser = null;

let micVisualizationActive = false;
let micFrequencyData = null;
let micWaveformData = null;

function setupMicrophoneAnalysis(stream) {
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume context if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    micAnalyser = audioContext.createAnalyser();
    micAnalyser.fftSize = 256;
    micAnalyser.smoothingTimeConstant = 0.7;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(micAnalyser);
    
    micFrequencyData = new Uint8Array(micAnalyser.frequencyBinCount);
    micWaveformData = new Uint8Array(micAnalyser.fftSize);
    
    // Start the visualization loop
    micVisualizationActive = true;
    updateMicVisualization();
}

function updateMicVisualization() {
    if (!micVisualizationActive || !micAnalyser) return;
    
    micAnalyser.getByteFrequencyData(micFrequencyData);
    micAnalyser.getByteTimeDomainData(micWaveformData);
    visualization.setAudioData(micFrequencyData, micWaveformData);
    
    requestAnimationFrame(updateMicVisualization);
}

function stopMicrophoneAnalysis() {
    micVisualizationActive = false;
}

function createPlaybackAnalyser() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    playbackAnalyser = audioContext.createAnalyser();
    playbackAnalyser.fftSize = 256;
    playbackAnalyser.smoothingTimeConstant = 0.8;
    
    return playbackAnalyser;
}

function startPlaybackVisualization() {
    if (!playbackAnalyser) return;
    
    const frequencyData = new Uint8Array(playbackAnalyser.frequencyBinCount);
    const waveformData = new Uint8Array(playbackAnalyser.fftSize);
    
    function update() {
        if (!isPlaying) return;
        
        playbackAnalyser.getByteFrequencyData(frequencyData);
        playbackAnalyser.getByteTimeDomainData(waveformData);
        visualization.setAudioData(frequencyData, waveformData);
        
        requestAnimationFrame(update);
    }
    update();
}

// =============================================================================
// PERSISTENCE
// =============================================================================
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const serverSettings = await res.json();
            settings = { ...DEFAULT_SETTINGS, ...serverSettings };
        }
    } catch (e) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
    applySettingsToUI();
}

async function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
    } catch (e) {}
}

function applySettingsToUI() {
    if (voiceSelect) voiceSelect.value = settings.voice || 'en_0';
    if (soundEffectsToggle) soundEffectsToggle.checked = settings.soundEffects;
    
    const sliders = [
        ['contextWindow', 'contextWindowValue', settings.contextWindow],
        ['temperature', 'tempValue', settings.temperature],
        ['topP', 'topPValue', settings.topP],
        ['topK', 'topKValue', settings.topK],
        ['maxTokens', 'maxTokensValue', settings.maxTokens],
        ['repeatPenalty', 'repeatPenaltyValue', settings.repeatPenalty],
        ['beamSize', 'beamSizeValue', settings.beamSize],
        ['vadThreshold', 'vadThresholdValue', settings.vadThreshold]
    ];
    
    sliders.forEach(([sliderId, displayId, value]) => {
        const slider = $(sliderId);
        const display = $(displayId);
        if (slider && display && value !== undefined) {
            slider.value = value;
            display.textContent = value;
        }
    });
    
    const vadFilter = $('vadFilter');
    if (vadFilter) vadFilter.checked = settings.vadFilter;
    
    const sampleRate = $('sampleRate');
    if (sampleRate) sampleRate.value = settings.sampleRate;
}

// =============================================================================
// HISTORY
// =============================================================================
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        if (res.ok) {
            const data = await res.json();
            conversationHistory = data.history || [];
            renderChatHistory();
        }
    } catch (e) {}
}

function addToHistory(userText, assistantText) {
    const entry = {
        user: userText,
        assistant: assistantText,
        timestamp: Date.now()
    };
    conversationHistory.push(entry);
    renderChatHistory();
}

function renderChatHistory() {
    const emptyState = $('emptyHistory');
    
    // Always clear existing messages first
    const messages = chatHistory.querySelectorAll('.chat-message');
    messages.forEach(m => m.remove());
    
    if (conversationHistory.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    conversationHistory.forEach((entry, idx) => {
        // User message
        if (entry.user) {
            const userMsg = document.createElement('div');
            userMsg.className = 'chat-message user';
            userMsg.innerHTML = `
                <div class="message-bubble">${escapeHtml(entry.user)}</div>
                <span class="message-time">${formatTime(entry.timestamp)}</span>
            `;
            chatHistory.appendChild(userMsg);
        }
        
        // Assistant message
        if (entry.assistant) {
            const assistantMsg = document.createElement('div');
            assistantMsg.className = 'chat-message assistant';
            assistantMsg.innerHTML = `
                <div class="message-bubble">${escapeHtml(entry.assistant)}</div>
                <span class="message-time">${formatTime(entry.timestamp)}</span>
            `;
            chatHistory.appendChild(assistantMsg);
        }
    });
    
    // Scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTranscript(userText, assistantText) {
    transcriptUser.textContent = userText || '';
    transcriptAssistant.textContent = assistantText || '';
    transcript.classList.add('visible');
}

function clearTranscript() {
    transcriptUser.textContent = '';
    transcriptAssistant.textContent = '';
    transcript.classList.remove('visible');
}

// =============================================================================
// SLIDERS
// =============================================================================
function setupSliders() {
    const sliders = [
        ['contextWindow', 'contextWindowValue'],
        ['temperature', 'tempValue'],
        ['topP', 'topPValue'],
        ['topK', 'topKValue'],
        ['maxTokens', 'maxTokensValue'],
        ['repeatPenalty', 'repeatPenaltyValue'],
        ['beamSize', 'beamSizeValue'],
        ['vadThreshold', 'vadThresholdValue']
    ];
    
    sliders.forEach(([sliderId, displayId]) => {
        const slider = $(sliderId);
        const display = $(displayId);
        if (slider && display) {
            slider.addEventListener('input', () => {
                display.textContent = slider.value;
            });
        }
    });
}

// =============================================================================
// MODALS
// =============================================================================
function openModal(modal) {
    modal.classList.add('show');
}

function closeModal(modal) {
    modal.classList.remove('show');
}

function applyMainSettings() {
    settings.soundEffects = soundEffectsToggle.checked;
    settings.inputDevice = inputSelect.value;
    settings.outputDevice = outputSelect.value;
    saveSettings();
    closeModal(settingsModal);
}

function applyAdvancedSettings() {
    settings.contextWindow = parseInt($('contextWindow').value);
    settings.temperature = parseFloat($('temperature').value);
    settings.topP = parseFloat($('topP').value);
    settings.topK = parseInt($('topK').value);
    settings.maxTokens = parseInt($('maxTokens').value);
    settings.repeatPenalty = parseFloat($('repeatPenalty').value);
    settings.beamSize = parseInt($('beamSize').value);
    settings.vadFilter = $('vadFilter').checked;
    settings.vadThreshold = parseInt($('vadThreshold').value);
    settings.sampleRate = parseInt($('sampleRate').value);
    saveSettings();
    closeModal(advancedModal);
}

function resetAdvancedDefaults() {
    const d = DEFAULT_SETTINGS;
    $('contextWindow').value = d.contextWindow;
    $('contextWindowValue').textContent = d.contextWindow;
    $('temperature').value = d.temperature;
    $('tempValue').textContent = d.temperature;
    $('topP').value = d.topP;
    $('topPValue').textContent = d.topP;
    $('topK').value = d.topK;
    $('topKValue').textContent = d.topK;
    $('maxTokens').value = d.maxTokens;
    $('maxTokensValue').textContent = d.maxTokens;
    $('repeatPenalty').value = d.repeatPenalty;
    $('repeatPenaltyValue').textContent = d.repeatPenalty;
    $('beamSize').value = d.beamSize;
    $('beamSizeValue').textContent = d.beamSize;
    $('vadFilter').checked = d.vadFilter;
    $('vadThreshold').value = d.vadThreshold;
    $('vadThresholdValue').textContent = d.vadThreshold;
    $('sampleRate').value = d.sampleRate;
}

// =============================================================================
// SIDEBAR
// =============================================================================
function toggleSidebar() {
    chatSidebar.classList.toggle('open');
    document.body.classList.toggle('sidebar-open');
}

// =============================================================================
// KNOWLEDGE BASE
// =============================================================================
let knowledgeFiles = [];
let currentEditingFile = null;

async function loadKnowledgeFiles() {
    try {
        const res = await fetch('/api/knowledge');
        const data = await res.json();
        knowledgeFiles = data.files || [];
        renderKnowledgeFiles();
    } catch (e) {
        console.error('Failed to load knowledge files:', e);
    }
}

function renderKnowledgeFiles() {
    const filesList = $('filesList');
    const emptyFiles = $('emptyFiles');
    const filesCount = $('filesCount');
    
    filesCount.textContent = `${knowledgeFiles.length} document${knowledgeFiles.length !== 1 ? 's' : ''}`;
    
    if (knowledgeFiles.length === 0) {
        emptyFiles.style.display = 'flex';
        // Remove any file items
        filesList.querySelectorAll('.file-item').forEach(f => f.remove());
        return;
    }
    
    emptyFiles.style.display = 'none';
    
    // Clear and rebuild
    filesList.querySelectorAll('.file-item').forEach(f => f.remove());
    
    knowledgeFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.filename = file.name;
        
        const sizeKB = (file.size / 1024).toFixed(1);
        const date = new Date(file.modified);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        item.innerHTML = `
            <div class="file-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
            </div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-meta">${sizeKB} KB • ${dateStr}</div>
            </div>
        `;
        
        item.onclick = () => openFileEditor(file.name);
        filesList.appendChild(item);
    });
}

async function openFileEditor(filename) {
    const editor = $('knowledgeEditor');
    const filenameInput = $('editorFilename');
    const contentArea = $('editorContent');
    const deleteBtn = $('editorDelete');
    
    // Highlight active file
    document.querySelectorAll('.file-item').forEach(f => f.classList.remove('active'));
    const activeItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
    if (activeItem) activeItem.classList.add('active');
    
    if (filename) {
        // Load existing file
        try {
            const res = await fetch(`/api/knowledge/${encodeURIComponent(filename)}`);
            const data = await res.json();
            filenameInput.value = data.name;
            contentArea.value = data.content;
            currentEditingFile = filename;
            deleteBtn.style.display = 'block';
        } catch (e) {
            console.error('Failed to load file:', e);
            return;
        }
    } else {
        // New file
        filenameInput.value = '';
        contentArea.value = '';
        currentEditingFile = null;
        deleteBtn.style.display = 'none';
    }
    
    editor.style.display = 'flex';
    filenameInput.focus();
}

function closeFileEditor() {
    $('knowledgeEditor').style.display = 'none';
    currentEditingFile = null;
    document.querySelectorAll('.file-item').forEach(f => f.classList.remove('active'));
}

async function saveKnowledgeFile() {
    const filename = $('editorFilename').value.trim();
    const content = $('editorContent').value;
    
    if (!filename) {
        alert('Please enter a filename');
        return;
    }
    
    try {
        const res = await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: filename, content: content })
        });
        
        const data = await res.json();
        if (data.status === 'ok') {
            await loadKnowledgeFiles();
            closeFileEditor();
        } else {
            alert(data.error || 'Failed to save file');
        }
    } catch (e) {
        console.error('Failed to save file:', e);
        alert('Failed to save file');
    }
}

async function deleteKnowledgeFile() {
    if (!currentEditingFile) return;
    
    if (!confirm(`Delete "${currentEditingFile}"?`)) return;
    
    try {
        await fetch(`/api/knowledge/${encodeURIComponent(currentEditingFile)}`, {
            method: 'DELETE'
        });
        await loadKnowledgeFiles();
        closeFileEditor();
    } catch (e) {
        console.error('Failed to delete file:', e);
    }
}

// =============================================================================
// SOUND EFFECTS
// =============================================================================
function playBeep(freq, dur, vol = 0.12) {
    if (!settings.soundEffects) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = vol;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        osc.stop(ctx.currentTime + dur);
    } catch (e) {}
}

const playStartSound = () => playBeep(880, 0.08);
const playStopSound = () => playBeep(440, 0.12);

// =============================================================================
// AUDIO PLAYBACK
// =============================================================================
function stopAllAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    audioQueue = [];
    isPlaying = false;
    visualization.setSpeaking(false);
}

// =============================================================================
// DEVICES
// =============================================================================
async function loadDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        inputSelect.innerHTML = '';
        devices.filter(d => d.kind === 'audioinput').forEach((device, i) => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.textContent = device.label || `Microphone ${i + 1}`;
            if (device.deviceId === settings.inputDevice || (!settings.inputDevice && i === 0)) opt.selected = true;
            inputSelect.appendChild(opt);
        });
        
        outputSelect.innerHTML = '';
        devices.filter(d => d.kind === 'audiooutput').forEach((device, i) => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.textContent = device.label || `Speaker ${i + 1}`;
            if (device.deviceId === settings.outputDevice || (!settings.outputDevice && i === 0)) opt.selected = true;
            outputSelect.appendChild(opt);
        });
    } catch (err) {
        inputSelect.innerHTML = '<option>Default Microphone</option>';
        outputSelect.innerHTML = '<option>Default Speaker</option>';
    }
}

// =============================================================================
// RECORDING
// =============================================================================
async function startRecording() {
    if (isRecording) return;
    stopAllAudio();
    if (currentWebSocket) {
        currentWebSocket.close();
        currentWebSocket = null;
    }
    
    playStartSound();
    setStatus('listening');
    talkBtn.classList.add('active');
    clearTranscript();
    audioChunks = [];
    
    try {
        const constraints = {
            audio: inputSelect.value ? { deviceId: { exact: inputSelect.value } } : true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        isRecording = true;  // Set this BEFORE setting up analysis
        setupMicrophoneAnalysis(stream);
        visualization.setActive(true);
        
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = sendAudio;
        mediaRecorder.start();
    } catch (err) {
        console.error('Recording error:', err);
        setStatus('error');
        talkBtn.classList.remove('active');
    }
}

function stopRecording() {
    if (!isRecording) return;
    playStopSound();
    stopMicrophoneAnalysis();  // Stop the visualization loop
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
    talkBtn.classList.remove('active');
    setStatus('processing');
    isRecording = false;
    visualization.setActive(false);
}

function setStatus(state) {
    const states = {
        ready: 'Ready',
        listening: 'Listening',
        processing: 'Processing',
        speaking: 'Speaking',
        error: 'Error'
    };
    
    statusText.textContent = states[state] || state;
    
    statusIndicator.classList.remove('listening', 'speaking', 'processing');
    if (state === 'listening') statusIndicator.classList.add('listening');
    if (state === 'speaking') statusIndicator.classList.add('speaking');
    if (state === 'processing') statusIndicator.classList.add('processing');
}

// =============================================================================
// SEND AUDIO
// =============================================================================
async function sendAudio() {
    const blob = new Blob(audioChunks, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append("file", blob, "input.wav");

    try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (!data.text || data.text.trim() === '') {
            setStatus('ready');
            return;
        }
        
        showTranscript(data.text, '');
        connectWebSocket(data.text);
    } catch (err) {
        console.error('Transcription error:', err);
        setStatus('error');
    }
}

// =============================================================================
// WEBSOCKET
// =============================================================================
function connectWebSocket(text) {
    const ws = new WebSocket(`ws://${location.host}/api/chat`);
    currentWebSocket = ws;
    
    settings.voice = voiceSelect.value;
    saveSettings();
    
    ws.onopen = () => {
        ws.send(JSON.stringify({
            text,
            voice: voiceSelect.value,
            settings
        }));
    };

    let fullResponse = '';
    audioQueue = [];
    isPlaying = false;
    let audioSourceConnected = false;

    ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
            if (!isMuted) {
                audioQueue.push(URL.createObjectURL(event.data));
                playQueue();
            }
        } else {
            const msg = JSON.parse(event.data);
            if (msg.type === "text_chunk") {
                fullResponse += msg.content;
                showTranscript(text, fullResponse);
            } else if (msg.type === "done") {
                // Add to history when done
                addToHistory(text, fullResponse);
                if (!isPlaying) setStatus('ready');
                currentWebSocket = null;
            }
        }
    };

    ws.onerror = () => {
        setStatus('error');
        currentWebSocket = null;
    };
    
    ws.onclose = () => { currentWebSocket = null; };

    async function playQueue() {
        if (isPlaying || audioQueue.length === 0 || isMuted) return;
        isPlaying = true;
        setStatus('speaking');
        visualization.setSpeaking(true);
        
        const audioUrl = audioQueue.shift();
        
        // Create audio element
        const audio = new Audio();
        currentAudio = audio;
        
        // Set up audio routing for visualization
        if (!audioSourceConnected && audioContext) {
            try {
                const analyser = createPlaybackAnalyser();
                audio.crossOrigin = 'anonymous';
                
                audio.addEventListener('canplay', () => {
                    try {
                        const source = audioContext.createMediaElementSource(audio);
                        source.connect(analyser);
                        analyser.connect(audioContext.destination);
                        audioSourceConnected = true;
                        startPlaybackVisualization();
                    } catch (e) {
                        // Source already connected, just play
                    }
                }, { once: true });
            } catch (e) {}
        }
        
        audio.src = audioUrl;
        
        if (audio.setSinkId && outputSelect.value) {
            try { await audio.setSinkId(outputSelect.value); } catch (e) {}
        }
        
        audio.play().catch(() => {});
        
        audio.onended = () => {
            isPlaying = false;
            currentAudio = null;
            if (audioQueue.length > 0) {
                playQueue();
            } else {
                visualization.setSpeaking(false);
                setStatus('ready');
            }
        };
        
        audio.onerror = () => {
            isPlaying = false;
            currentAudio = null;
            visualization.setSpeaking(false);
            playQueue();
        };
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================
function setupEventListeners() {
    // Talk button
    talkBtn.addEventListener('mousedown', startRecording);
    talkBtn.addEventListener('mouseup', stopRecording);
    talkBtn.addEventListener('mouseleave', () => { if (isRecording) stopRecording(); });
    
    // Orb interaction
    orbContainer.addEventListener('mousedown', startRecording);
    orbContainer.addEventListener('mouseup', stopRecording);
    orbContainer.addEventListener('mouseleave', () => { if (isRecording) stopRecording(); });
    
    // Touch support
    orbContainer.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
    orbContainer.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });
    talkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
    talkBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

    // Spacebar
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat && !['SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            startRecording();
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') { e.preventDefault(); stopRecording(); }
    });

    // Mute
    muteBtn.onclick = () => {
        isMuted = !isMuted;
        $('volumeOnIcon').style.display = isMuted ? 'none' : 'block';
        $('volumeOffIcon').style.display = isMuted ? 'block' : 'none';
        if (isMuted) stopAllAudio();
    };

    // Reset
    resetBtn.onclick = async () => {
        stopAllAudio();
        if (currentWebSocket) { currentWebSocket.close(); currentWebSocket = null; }
        clearTranscript();
        setStatus('ready');
        talkBtn.classList.remove('active');
        isRecording = false;
        visualization.setActive(false);
        conversationHistory = [];
        renderChatHistory();
        try { await fetch('/api/history', { method: 'DELETE' }); } catch (e) {}
    };

    // History sidebar
    historyBtn.onclick = toggleSidebar;
    closeSidebar.onclick = toggleSidebar;

    // Settings modal
    settingsBtn.onclick = () => openModal(settingsModal);
    $('closeSettings').onclick = () => closeModal(settingsModal);
    $('settingsCancel').onclick = () => closeModal(settingsModal);
    $('settingsApply').onclick = applyMainSettings;
    settingsModal.querySelector('.modal-backdrop').onclick = () => closeModal(settingsModal);

    // Advanced modal
    $('openAdvanced').onclick = () => { closeModal(settingsModal); openModal(advancedModal); };
    $('closeAdvanced').onclick = () => closeModal(advancedModal);
    $('advancedCancel').onclick = () => closeModal(advancedModal);
    $('advancedApply').onclick = applyAdvancedSettings;
    $('advancedDefaults').onclick = resetAdvancedDefaults;
    advancedModal.querySelector('.modal-backdrop').onclick = () => closeModal(advancedModal);
    
    // Knowledge modal
    knowledgeBtn.onclick = () => {
        loadKnowledgeFiles();
        openModal(knowledgeModal);
    };
    $('closeKnowledge').onclick = () => {
        closeFileEditor();
        closeModal(knowledgeModal);
    };
    $('newFileBtn').onclick = () => openFileEditor(null);
    $('editorCancel').onclick = closeFileEditor;
    $('editorSave').onclick = saveKnowledgeFile;
    $('editorDelete').onclick = deleteKnowledgeFile;
    knowledgeModal.querySelector('.modal-backdrop').onclick = () => {
        closeFileEditor();
        closeModal(knowledgeModal);
    };
}

// =============================================================================
// INIT
// =============================================================================
async function init() {
    console.log('🚀 MIDAS initializing...');
    
    visualization = new OrbVisualization();
    
    setupSliders();
    setupEventListeners();
    await loadSettings();
    await loadDevices();
    await loadHistory();
    
    console.log('✅ MIDAS ready');
}

document.addEventListener('DOMContentLoaded', init);
