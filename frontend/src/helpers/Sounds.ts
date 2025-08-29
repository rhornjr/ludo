export class Sounds {
  private static audioContext: AudioContext | null = null;
  private static audioInitialized = false;

  // Helper function to get or create audio context for Safari compatibility
  static async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      const newContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContext = newContext;
      
      // For Safari, we need to resume the context on first user interaction
      if (newContext.state === 'suspended') {
        try {
          await newContext.resume();
          console.log('Audio context resumed for Safari');
        } catch (error) {
          console.log('Failed to resume audio context:', error);
        }
      }
      
      return newContext;
    }
    
    // If context exists but is suspended, try to resume it
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('Audio context resumed for Safari');
      } catch (error) {
        console.log('Failed to resume audio context:', error);
      }
    }
    
    return this.audioContext;
  }

  // Initialize audio context on first user interaction
  static async initializeAudio(): Promise<void> {
    if (!this.audioContext) {
      const newContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContext = newContext;
      console.log('Audio context created for Safari');
    }
    
    // Get the current audio context (either existing or newly created)
    const ctx = this.audioContext || await this.getAudioContext();
    
    if (ctx && !this.audioInitialized) {
      try {
        // Resume audio context if it's suspended (Safari requirement)
        if (ctx.state === 'suspended') {
          console.log('Resuming suspended audio context');
          await ctx.resume();
          console.log('Audio context resumed successfully');
        }
        
        // Force a small audio test to ensure context is working
        if (ctx.state === 'running') {
          const testOscillator = ctx.createOscillator();
          const testGain = ctx.createGain();
          
          testOscillator.connect(testGain);
          testGain.connect(ctx.destination);
          
          testGain.gain.setValueAtTime(0.01, ctx.currentTime); // Very quiet test
          testOscillator.frequency.setValueAtTime(200, ctx.currentTime);
          
          testOscillator.start(ctx.currentTime);
          testOscillator.stop(ctx.currentTime + 0.01);
          
          console.log('Audio context test successful');
        }
        
        this.audioInitialized = true;
        console.log('Audio context fully initialized');
      } catch (error) {
        console.log('Failed to initialize audio context:', error);
      }
    }
  }

  // Play dice rolling sound
  static async playDiceRollSound(): Promise<void> {
    try {
      const ctx = await this.getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.setValueAtTime(200, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (error) {
      console.log('Audio not supported or blocked by browser');
    }
  }

  // Generic sound player (keeping the existing playSound method for compatibility)
  static async playSound(): Promise<void> {
    try {
      console.log('playSound called');
      
      // Use the shared audio context
      const ctx = await this.getAudioContext();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.05);
    } catch (error) {
      console.log('Audio not supported or blocked by browser');
    }
  }

  // Play positive sound for extra roll squares
  static async playExtraRollSound(): Promise<void> {
    try {
      console.log('playExtraRollSound called');
      
      // Use the shared audio context
      const ctx = await this.getAudioContext();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 400;
      oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);
      gainNode.gain.value = 0.15;
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.log('Audio not supported or blocked by browser');
    }
  }

  // Play sad sound when opponent discs are sent back
  static async playSadSound(): Promise<void> {
    try {
      console.log('playSadSound called');
      
      // Use the shared audio context
      const ctx = await this.getAudioContext();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Create a sad descending tone
      oscillator.frequency.value = 300;
      oscillator.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.3);
      gainNode.gain.value = 0.2;
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.log('Audio not supported or blocked by browser');
    }
  }

  // Play victory sound
  static async playVictorySound(): Promise<void> {
    try {
      console.log('playVictorySound called');
      
      // Use the shared audio context
      const ctx = await this.getAudioContext();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Create a victory ascending tone sequence
      oscillator.frequency.value = 400;
      oscillator.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.1);
      oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
      oscillator.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.3);
      gainNode.gain.value = 0.2;
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.log('Audio not supported or blocked by browser');
    }
  }

  // Play thump sound for knocked disc
  static async playThumpSound(): Promise<void> {
    try {
      const ctx = await this.getAudioContext();
      
      // Create a simple thump sound - low frequency, quick decay
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Low frequency for thump sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(80, ctx.currentTime);
      
      // Quick attack and decay for thump effect
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
      
    } catch (error) {
      console.log('Audio not supported');
    }
  }
}
