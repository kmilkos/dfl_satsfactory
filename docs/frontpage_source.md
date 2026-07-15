<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>DAEMONFORGE SERVER PORTAL</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&amp;family=Outfit:wght@300;400;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        :root {
            --ficsit-orange: #f97316;
            --ficsit-emerald: #4edea3;
            --deep-obsidian: #0e131f;
        }

        body {
            background-color: var(--deep-obsidian);
            background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0);
            background-size: 16px 16px;
            color: #dde2f3;
            font-family: 'Outfit', sans-serif;
            overflow-x: hidden;
        }

        .font-mono { font-family: 'JetBrains Mono', monospace; }

        .glass-panel {
            background: rgba(14, 19, 31, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid #1e293b;
            position: relative;
        }

        .glass-panel::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%);
            pointer-events: none;
        }

        .chamfer-br {
            clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
        }

        .chamfer-tl {
            clip-path: polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px);
        }

        .hazard-stripes {
            background: repeating-linear-gradient(
                45deg,
                #f97316,
                #f97316 10px,
                #000 10px,
                #000 20px
            );
        }

        .scanline {
            width: 100%;
            height: 100px;
            z-index: 10;
            background: linear-gradient(0deg, rgba(249, 115, 22, 0) 0%, rgba(249, 115, 22, 0.05) 50%, rgba(249, 115, 22, 0) 100%);
            opacity: 0.1;
            position: absolute;
            bottom: 100%;
            animation: scanline 8s linear infinite;
        }

        @keyframes scanline {
            0% { bottom: 100%; }
            100% { bottom: -100px; }
        }

        .pulse-dot {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: .5; transform: scale(1.2); }
        }

        .crt-text {
            text-shadow: 0 0 5px rgba(78, 222, 163, 0.5);
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-primary-container": "#582200",
                      "surface-variant": "#2f3542",
                      "inverse-on-surface": "#2b303d",
                      "error": "#ffb4ab",
                      "outline-variant": "#584237",
                      "surface-container-highest": "#2f3542",
                      "surface-tint": "#ffb690",
                      "inverse-surface": "#dde2f3",
                      "on-tertiary-container": "#00306e",
                      "surface-container-high": "#242a36",
                      "primary-fixed": "#ffdbca",
                      "surface-container": "#1a202c",
                      "surface-container-lowest": "#080e1a",
                      "on-error-container": "#ffdad6",
                      "on-secondary-fixed": "#002113",
                      "on-secondary-fixed-variant": "#005236",
                      "on-primary-fixed": "#341100",
                      "on-surface-variant": "#e0c0b1",
                      "on-secondary": "#003824",
                      "on-secondary-container": "#00311f",
                      "inverse-primary": "#9d4300",
                      "surface-bright": "#343946",
                      "tertiary": "#adc6ff",
                      "on-primary": "#552100",
                      "surface-container-low": "#161c28",
                      "tertiary-fixed-dim": "#adc6ff",
                      "on-tertiary-fixed": "#001a42",
                      "on-tertiary": "#002e6a",
                      "primary-fixed-dim": "#ffb690",
                      "tertiary-fixed": "#d8e2ff",
                      "outline": "#a78b7d",
                      "on-background": "#dde2f3",
                      "secondary-fixed-dim": "#4edea3",
                      "on-tertiary-fixed-variant": "#004395",
                      "secondary": "#4edea3",
                      "primary-container": "#f97316",
                      "surface": "#0e131f",
                      "tertiary-container": "#6399ff",
                      "secondary-container": "#00a572",
                      "on-error": "#690005",
                      "error-container": "#93000a",
                      "on-surface": "#dde2f3",
                      "secondary-fixed": "#6ffbbe",
                      "primary": "#ffb690",
                      "on-primary-fixed-variant": "#783200",
                      "surface-dim": "#0e131f",
                      "background": "#0e131f"
              },
              "borderRadius": {
                      "DEFAULT": "0.125rem",
                      "lg": "0.25rem",
                      "xl": "0.5rem",
                      "full": "0.75rem"
              },
              "spacing": {
                      "margin": "24px",
                      "panel-padding": "20px",
                      "gutter": "16px",
                      "unit": "4px",
                      "container-max": "1440px"
              },
              "fontFamily": {
                      "body-lg": ["Outfit"],
                      "label-caps": ["JetBrains Mono"],
                      "headline-md": ["JetBrains Mono"],
                      "headline-lg": ["JetBrains Mono"],
                      "code-sm": ["JetBrains Mono"],
                      "display-lg": ["JetBrains Mono"],
                      "body-md": ["Outfit"]
              },
              "fontSize": {
                      "body-lg": ["18px", {"lineHeight": "1.6", "fontWeight": "400"}],
                      "label-caps": ["12px", {"lineHeight": "1", "letterSpacing": "0.1em", "fontWeight": "700"}],
                      "headline-md": ["20px", {"lineHeight": "1.4", "fontWeight": "600"}],
                      "headline-lg": ["32px", {"lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "600"}],
                      "code-sm": ["14px", {"lineHeight": "1.5", "fontWeight": "400"}],
                      "display-lg": ["48px", {"lineHeight": "1.1", "letterSpacing": "-0.04em", "fontWeight": "700"}],
                      "body-md": ["16px", {"lineHeight": "1.6", "fontWeight": "400"}]
              }
            },
          },
        }
    </script>
</head>
<body class="min-h-screen flex flex-col">
<!-- Top Navigation -->
<header class="fixed top-0 w-full z-50 flex justify-between items-center px-margin h-16 bg-surface/60 backdrop-blur-xl border-b border-outline-variant">
<div class="flex items-center gap-4">
<span class="font-headline-lg text-headline-lg tracking-tighter text-primary uppercase">DAEMONFORGE // Node-01</span>
<div class="h-6 w-[2px] bg-outline-variant"></div>
<span class="font-label-caps text-label-caps text-on-surface-variant">SUB-SECTOR: ALPHA-4</span>
</div>
<nav class="hidden md:flex items-center gap-gutter">
<a class="text-primary border-b-2 border-primary pb-1 font-label-caps text-label-caps" href="#">Cluster</a>
<a class="text-on-surface-variant font-label-caps text-label-caps hover:text-primary transition-colors" href="#">Telemetry</a>
<a class="text-on-surface-variant font-label-caps text-label-caps hover:text-primary transition-colors" href="#">Logistics</a>
<a class="text-on-surface-variant font-label-caps text-label-caps hover:text-primary transition-colors" href="#">Archives</a>
</nav>
<div class="flex items-center gap-4">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary">terminal</span>
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer">settings</span>
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer">notifications</span>
</div>
</div>
</header>
<!-- Side Nav (Visual Placeholder) -->
<aside class="hidden md:flex flex-col fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-surface-container-low/80 backdrop-blur-lg border-r border-outline-variant p-margin">
<div class="mb-8">
<div class="flex items-center gap-3 mb-2">
<img class="w-10 h-10 rounded-sm border border-primary" data-alt="A stylized digital badge for a FICSIT engineer, featuring industrial iconography, a small holographic avatar, and a metallic orange texture against a dark high-tech background." src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4_1EksFrK-3EEN-Ll5n4VB_FwpB7wdApVU55gwb_-wxUwIgoWz6OhN2Qtj2DFUL1AGm6hrmMyO8Vrdo0wnqTsaBOMgJpvGWshwf1Z8-QEXHSUAM6R1Jh-JPiQPJAv8zQ2ZrhbpECUn9f8ccHKpe7qj4y6YjUCcU8ok3xEneoQjSs3paRzQHO3dBOEXNpgGaP1-s8PRyD2OgLJNEE7BNoSACY_sCjLOXlTPdm8XH6Rf1Nj2RQPUMG1"/>
<div>
<p class="font-headline-md text-headline-md text-primary leading-none">ADM-UNIT-01</p>
<p class="font-label-caps text-label-caps text-on-surface-variant opacity-60">Protocol: Gamma-9</p>
</div>
</div>
</div>
<nav class="flex flex-col gap-1">
<div class="bg-primary-container text-on-primary-container border-l-4 border-primary px-4 py-3 flex items-center gap-3 chamfer-br">
<span class="material-symbols-outlined">memory</span>
<span class="font-label-caps text-label-caps">Core</span>
</div>
<div class="text-on-surface-variant hover:bg-surface-variant/30 px-4 py-3 flex items-center gap-3 transition-all cursor-pointer">
<span class="material-symbols-outlined">bolt</span>
<span class="font-label-caps text-label-caps">Power</span>
</div>
<div class="text-on-surface-variant hover:bg-surface-variant/30 px-4 py-3 flex items-center gap-3 transition-all cursor-pointer">
<span class="material-symbols-outlined">group</span>
<span class="font-label-caps text-label-caps">Pioneers</span>
</div>
<div class="text-on-surface-variant hover:bg-surface-variant/30 px-4 py-3 flex items-center gap-3 transition-all cursor-pointer">
<span class="material-symbols-outlined">lan</span>
<span class="font-label-caps text-label-caps">Network</span>
</div>
</nav>
<button class="mt-auto bg-primary text-on-primary font-label-caps text-label-caps py-4 chamfer-br hover:shadow-[0_0_15px_rgba(249,115,22,0.5)] transition-all uppercase">Initialize Scan</button>
</aside>
<!-- Main Content -->
<main class="md:ml-64 pt-20 px-margin pb-margin flex-grow relative">
<div class="scanline"></div>
<!-- HERO SECTION -->
<section class="mb-gutter">
<div class="glass-panel p-8 chamfer-tl border-l-4 border-l-primary relative overflow-hidden">
<div class="absolute top-0 right-0 w-32 h-8 hazard-stripes opacity-20 rotate-45 translate-x-12 -translate-y-4"></div>
<div class="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
<div>
<p class="font-label-caps text-label-caps text-primary mb-2">DAEMONFORGE // Satisfactory Node</p>
<h1 class="font-display-lg text-display-lg text-on-surface leading-tight mb-4">CO-OPERATIVE <br/> FACTORY OPERATIONS</h1>
<div class="flex flex-wrap gap-4">
<div class="bg-primary/10 border border-primary/30 px-3 py-1 flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-secondary pulse-dot"></span>
<span class="font-code-sm text-code-sm text-secondary">STATUS: ONLINE (SML ACTIVE)</span>
</div>
<div class="bg-surface-variant/40 border border-outline-variant px-3 py-1 font-code-sm text-code-sm">
                                VERSION: 1.2.0-CL-495413
                            </div>
<div class="bg-surface-variant/40 border border-outline-variant px-3 py-1 font-code-sm text-code-sm">
                                SESSION: COME HERE
                            </div>
</div>
</div>
<div class="hidden lg:block w-64 h-32 relative">

</div>
</div>
</div>
</section>
<!-- METRICS GRID -->
<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-gutter">
<!-- Card 1 -->
<div class="glass-panel p-panel-padding flex flex-col justify-between group hover:border-primary/50 transition-colors">
<div class="flex justify-between items-start mb-4">
<span class="font-label-caps text-label-caps text-on-surface-variant">DAEMON UPTIME</span>
<span class="font-label-caps text-[10px] text-primary">MOD-01</span>
</div>
<div class="font-headline-lg text-headline-lg text-primary font-mono">03:29:45</div>
<div class="mt-4 h-1 bg-surface-variant rounded-full overflow-hidden">
<div class="h-full bg-primary w-2/3"></div>
</div>
</div>
<!-- Card 2 -->
<div class="glass-panel p-panel-padding flex flex-col justify-between group hover:border-primary/50 transition-colors">
<div class="flex justify-between items-start mb-4">
<span class="font-label-caps text-label-caps text-on-surface-variant">PIONEERS</span>
<span class="font-label-caps text-[10px] text-primary">USR-SYS</span>
</div>
<div class="flex items-end gap-3">
<span class="font-headline-lg text-headline-lg text-on-surface font-mono">2 / 8</span>
<div class="flex -space-x-2 mb-1">
<div class="w-8 h-8 rounded-full border-2 border-surface bg-surface-variant flex items-center justify-center overflow-hidden">
<img class="object-cover w-full h-full" data-alt="A pixelated sci-fi avatar of a factory engineer wearing a yellow safety helmet and futuristic goggles, set against a dark industrial background with orange glowing accents." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAXAhQ1tQIqLizW2LEaix-eY34qbpLNAD_Nnl9HWIJAiX9Z2xRtQrqQKKj4qEPkwJtf3ifW5YpFe6g1C8Qh_RVO6ilFRSigbVLMDPRUPGzaKQ2LejCYeAdesAlPdM2F5UJBHiGpMmVBeAAddNEQ3eSvzR2AUq4Jo3XYQlg0CAXUtFqGwG6lmmgh0KIGV53wD3Uo3EeH1BmSzlnNAA0nOXiVMs7MbltcW2lfeNPpwipR-9O2YQ28lc6"/>
</div>
<div class="w-8 h-8 rounded-full border-2 border-surface bg-surface-variant flex items-center justify-center overflow-hidden">
<img class="object-cover w-full h-full" data-alt="A high-contrast digital portrait of a technical specialist wearing an exoskeleton suit with glowing blue elements, designed in a gritty industrial aesthetic suitable for a game interface." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcnPaWCBIZQqyOt1d6m6v14wzy7fttBWmVi9XKs77isJD6fxUqS-JHau9IOSplONQPLMxD5ZaaFDQ1Sj1My9P68qj-4SKuDyKlvAIrXB7jkA-COveLwyYPAl1jJHKoV0G_QhBZaHD5Oasf6VHzDoBhFT-us3w-A2jRoVoup_HDRLsXg1X_z8k4KfXeTWHhTN-sLgc4knSityfDJjaM-WR7g6QZ3k4jkJQctT5agkEHCNJc5KKBlDZQ"/>
</div>
</div>
</div>
<p class="font-label-caps text-[10px] text-on-surface-variant mt-2 uppercase">Current: [Pioneer14, MaxPowneer]</p>
</div>
<!-- Card 3 -->
<div class="glass-panel p-panel-padding flex flex-col justify-between group hover:border-primary/50 transition-colors">
<div class="flex justify-between items-start mb-2">
<span class="font-label-caps text-label-caps text-on-surface-variant">CORE CPU LOAD</span>
<span class="font-label-caps text-[10px] text-primary">PWR-SYS</span>
</div>
<div class="flex items-center gap-4">
<span class="font-headline-lg text-headline-lg text-on-surface font-mono">14.5%</span>
<div class="flex-grow h-12 relative overflow-hidden">
<svg class="w-full h-full" preserveaspectratio="none" viewbox="0 0 100 40">
<path d="M0,30 L10,32 L20,15 L30,25 L40,10 L50,20 L60,5 L70,15 L80,25 L90,12 L100,20" fill="none" stroke="#f97316" stroke-width="2" vector-effect="non-scaling-stroke"></path>
</svg>
</div>
</div>
<p class="font-label-caps text-[10px] text-on-surface-variant mt-2">THERMAL: 42°C | FAN: 2400 RPM</p>
</div>
<!-- Card 4 -->
<div class="glass-panel p-panel-padding flex flex-col justify-between group hover:border-primary/50 transition-colors">
<div class="flex justify-between items-start mb-4">
<span class="font-label-caps text-label-caps text-on-surface-variant">RAM ALLOCATED</span>
<span class="font-label-caps text-[10px] text-primary">MEM-01</span>
</div>
<div class="font-headline-lg text-headline-lg text-on-surface font-mono">8.42 <span class="text-on-surface-variant text-headline-md">/ 16 GB</span></div>
<div class="flex gap-1 mt-4">
<div class="h-2 w-full bg-primary"></div>
<div class="h-2 w-full bg-primary"></div>
<div class="h-2 w-full bg-primary"></div>
<div class="h-2 w-full bg-primary"></div>
<div class="h-2 w-full bg-primary"></div>
<div class="h-2 w-full bg-primary"></div>
<div class="h-2 w-full bg-surface-variant"></div>
<div class="h-2 w-full bg-surface-variant"></div>
<div class="h-2 w-full bg-surface-variant"></div>
<div class="h-2 w-full bg-surface-variant"></div>
</div>
</div>
</section>
<!-- FACTORY TELEMETRY -->
<section class="grid grid-cols-1 lg:grid-cols-2 gap-gutter mb-gutter">
<!-- Left: Power Grid -->
<div class="glass-panel p-panel-padding relative">
<div class="flex justify-between items-center mb-6">
<h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
<span class="material-symbols-outlined text-secondary">bolt</span>
                        Ficsit Power Grid Matrix
                    </h3>
<span class="font-code-sm text-code-sm text-secondary bg-secondary/10 px-2 py-1 rounded-sm border border-secondary/20">STABLE</span>
</div>
<div class="grid grid-cols-2 gap-8 mb-6">
<div>
<p class="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Capacity</p>
<p class="font-display-lg text-headline-lg font-mono text-on-surface">4500 MW</p>
</div>
<div>
<p class="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">Consumed</p>
<p class="font-display-lg text-headline-lg font-mono text-secondary">3120 MW</p>
</div>
</div>
<div class="h-48 w-full bg-surface-container/50 rounded-sm border border-outline-variant/30 relative overflow-hidden">

<div class="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-secondary/20 to-transparent"></div>
<!-- Area Chart Visual -->
<svg class="absolute bottom-0 left-0 w-full h-2/3" preserveaspectratio="none" viewbox="0 0 100 100">
<path d="M0,100 L0,50 L10,55 L20,40 L30,45 L40,30 L50,35 L60,25 L70,30 L80,20 L90,25 L100,10 L100,100 Z" fill="rgba(78, 222, 163, 0.1)"></path>
<path d="M0,50 L10,55 L20,40 L30,45 L40,30 L50,35 L60,25 L70,30 L80,20 L90,25 L100,10" fill="none" stroke="#4edea3" stroke-width="2" vector-effect="non-scaling-stroke"></path>
</svg>
<div class="absolute top-2 left-2 flex gap-1">
<div class="w-1 h-1 bg-secondary rounded-full"></div>
<div class="w-1 h-1 bg-secondary rounded-full"></div>
<div class="w-1 h-1 bg-secondary rounded-full"></div>
</div>
</div>
</div>
<!-- Right: Production Output -->
<div class="glass-panel p-panel-padding">
<div class="flex justify-between items-center mb-6">
<h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
<span class="material-symbols-outlined text-primary">conveyor_belt</span>
                        Assembly Output Throughput
                    </h3>
</div>
<div class="space-y-6">
<!-- Item 1 -->
<div class="group">
<div class="flex justify-between mb-2">
<span class="font-label-caps text-label-caps text-on-surface uppercase">Screws</span>
<span class="font-code-sm text-code-sm text-primary">420 / min</span>
</div>
<div class="h-6 flex bg-surface-variant/30 border border-outline-variant overflow-hidden relative">
<div class="h-full bg-primary flex items-center px-2 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all" style="width: 84%">
<div class="w-full h-[1px] bg-white/20"></div>
</div>
<div class="absolute inset-0 flex">
<div class="h-full w-[2px] bg-surface ml-auto mr-12 opacity-50"></div>
<div class="h-full w-[2px] bg-surface mr-12 opacity-50"></div>
<div class="h-full w-[2px] bg-surface mr-12 opacity-50"></div>
</div>
</div>
</div>
<!-- Item 2 -->
<div class="group">
<div class="flex justify-between mb-2">
<span class="font-label-caps text-label-caps text-on-surface uppercase">Reinforced Iron Plates</span>
<span class="font-code-sm text-code-sm text-primary">80 / min</span>
</div>
<div class="h-6 flex bg-surface-variant/30 border border-outline-variant overflow-hidden">
<div class="h-full bg-primary flex items-center px-2" style="width: 60%">
<div class="w-full h-[1px] bg-white/20"></div>
</div>
</div>
</div>
<!-- Item 3 -->
<div class="group">
<div class="flex justify-between mb-2">
<span class="font-label-caps text-label-caps text-on-surface uppercase">Modular Frames</span>
<span class="font-code-sm text-code-sm text-primary">15 / min</span>
</div>
<div class="h-6 flex bg-surface-variant/30 border border-outline-variant overflow-hidden">
<div class="h-full bg-primary flex items-center px-2" style="width: 35%">
<div class="w-full h-[1px] bg-white/20"></div>
</div>
</div>
</div>
</div>
<div class="mt-8 p-3 bg-surface-variant/20 border-t border-dashed border-outline-variant">
<p class="font-code-sm text-[11px] text-on-surface-variant uppercase flex items-center gap-2">
<span class="material-symbols-outlined text-[14px]">warning</span>
                        Warning: Steel Pipe supply at 12% capacity. Logistics bottleneck detected at Terminal 04.
                    </p>
</div>
</div>
</section>
<!-- CHAT BRIDGE & MASCOT -->
<section class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
<!-- Console -->
<div class="lg:col-span-2 glass-panel chamfer-br bg-black p-panel-padding font-mono overflow-hidden h-64 relative">
<div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,rgba(78,222,163,0.05)_0%,transparent_100%)]"></div>
<div class="flex items-center gap-2 border-b border-secondary/20 pb-2 mb-4">
<div class="w-2 h-2 rounded-full bg-secondary"></div>
<span class="text-secondary text-[11px] crt-text">DAEMON_CLI :: SYSTEM_LOGS</span>
</div>
<div class="space-y-1 text-secondary text-sm overflow-y-auto h-[calc(100%-40px)] crt-text">
<p><span class="opacity-40">[08:00:01]</span> SML v3.12.0 Loaded...</p>
<p><span class="opacity-40">[08:00:04]</span> API Hook established with Satisfactory Node-01</p>
<p><span class="opacity-40">[08:15:32]</span> Pioneer [Pioneer14] connected (latency: 24ms)</p>
<p><span class="text-on-surface"><span class="opacity-40">[08:16:01]</span> Chat: [MaxPowneer] -&gt; Starting heavy modular frame assembly line</span></p>
<p><span class="opacity-40">[08:20:11]</span> Resource Overflow detected at AWC-South</p>
<p><span class="opacity-40">[08:25:00]</span> Autosaving session...</p>
<p class="animate-pulse">_</p>
</div>
</div>
<!-- Mascot/Greg -->
<div class="flex flex-col justify-end relative">
<div class="glass-panel p-6 mb-4 relative bg-tertiary-container/10 border-tertiary">
<p class="font-body-md text-on-surface italic">"Factory throughput is optimal. Do not stand underneath space elevator payloads."</p>
<div class="absolute -bottom-2 right-8 w-4 h-4 bg-surface rotate-45 border-r border-b border-outline-variant"></div>
</div>
<div class="flex items-center gap-4 self-end pr-4">
<div class="text-right">
<p class="font-label-caps text-label-caps text-primary">GREG</p>
<p class="font-code-sm text-[10px] text-on-surface-variant uppercase">Safety Compliance AI</p>
</div>
<div class="w-16 h-16 rounded-sm border-2 border-primary overflow-hidden bg-surface-container">
<img class="w-full h-full object-cover" data-alt="A stylized technical illustration of a floating spherical AI mascot with a glowing orange lens, featuring industrial paneling and small hazard stripes, set in a dark server room environment." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8BGmefMdsCPVQu2C5CHAAsBJUBLfHHU-7ywS1v3IE5P25NrpaZ8giZvXr75YSHYjlUEIjiUzARVPFiZTifMvavSdw7-vspq_e9neb8k7_szC6tHVR3tLVW2vaUX2YOPr46lHyM272Jyfk6VERyjUioR0G1So0KG6n9xxt1Kwgk2sBw9wnAQCuge0KJVRfk_BOxvmVjY36tVgG7_u8IZ9wio2g5yI45H62TtHX42rdtQr9c5qYDvbi"/>
</div>
</div>
</div>
</section>
</main>
<!-- Footer -->
<footer class="w-full py-gutter px-margin flex flex-col md:flex-row justify-between items-center bg-surface-container-lowest border-t border-outline-variant md:ml-64 md:w-[calc(100%-16rem)]">
<p class="font-code-sm text-code-sm uppercase text-on-surface-variant mb-4 md:mb-0">© 2024 FICSIT INC. // DAEMONFORGE PROTOCOL V.4.2</p>
<div class="flex gap-margin">
<a class="font-code-sm text-code-sm uppercase text-on-surface-variant hover:text-secondary transition-colors" href="#">System Logs</a>
<a class="font-code-sm text-code-sm uppercase text-on-surface-variant hover:text-secondary transition-colors" href="#">Network Status</a>
<a class="font-code-sm text-code-sm uppercase text-on-surface-variant hover:text-secondary transition-colors" href="#">Legal Data</a>
</div>
</footer>
<script>
        // Micro-interactions for terminal input feel
        document.addEventListener('keydown', (e) => {
            if(e.key === 't' && e.ctrlKey) {
                console.log("Terminal Override Initiated");
                // Visual feedback could go here
            }
        });

        // Atmospheric parallax or hover effects can be added here
        const panels = document.querySelectorAll('.glass-panel');
        panels.forEach(panel => {
            panel.addEventListener('mousemove', (e) => {
                const rect = panel.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                panel.style.setProperty('--mouse-x', `${x}px`);
                panel.style.setProperty('--mouse-y', `${y}px`);
            });
        });
    </script>
</body></html>
