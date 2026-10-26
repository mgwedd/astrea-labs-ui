import type { Contribution, Project, TechnicalNote } from './types';

const gh = (repo: string, path = '') => `https://github.com/${repo}${path}`;
const doc = (repo: string, file: string) => gh(repo, `/blob/main/${file}`);

export const projects: Project[] = [
  {
    slug: 'aletheia',
    name: 'Aletheia',
    tagline: 'Session notes for therapists, written on your Mac and kept on your Mac.',
    summary:
      'Records a video-call session, transcribes it on-device, drafts a progress note, and lets you search and ask questions across a patient’s history. Nothing leaves the machine.',
    description: [
      'Aletheia is a native macOS app for clinicians who run sessions over video. It captures your microphone and the call audio as separate tracks, transcribes them locally with whisper.cpp on Metal, and drafts a progress note in the format you already use: narrative, SOAP, DAP, BIRP or GIRP.',
      'Speech recognition and the language model both run on the Mac. There are no accounts, no analytics and no telemetry, and raw audio is deleted after transcription by default. The app picks a model sized to your hardware and downloads it in-app, pinned by commit and verified by SHA-256.',
      'Ask answers questions about one session or a patient’s whole history, and every answer says how much of the record it actually read. Global search uses SQLite FTS5 with sound-alike matching for names, because speech models misspell them.',
    ],
    domains: ['software', 'ai', 'security'],
    status: 'beta',
    year: 2026,
    stack: ['Swift', 'SwiftUI', 'whisper.cpp', 'llama.cpp', 'SQLite FTS5', 'ScreenCaptureKit'],
    highlights: [
      'On-device transcription and note drafting — no server ever sees patient data',
      'Grammar-constrained notes in narrative, SOAP, DAP, BIRP or GIRP format',
      'Ask across a patient’s history, with a coverage label on patient-wide answers',
      'App Sandbox, app lock, audit log without patient content, HIPAA Security Rule mapping',
      'Automatic semver releases from CI on every merge',
    ],
    repo: { owner: 'mgwedd', name: 'aletheia' },
    subdomain: 'aletheia',
    links: {
      docs: doc('mgwedd/aletheia', 'docs/SETUP-GUIDE.md'),
      changelog: doc('mgwedd/aletheia', 'CHANGELOG.md'),
    },
    releases: { owner: 'mgwedd', name: 'aletheia' },
    downloads: [
      {
        platform: 'macos',
        label: 'Download for macOS',
        url: gh('mgwedd/aletheia', '/releases/latest'),
        note: 'macOS 14+ · Apple Silicon with 16 GB recommended',
      },
    ],
    license: 'Source-available · all rights reserved',
    platforms: ['macos'],
    featured: true,
    order: 1,
  },
  {
    slug: 'groundwork',
    name: 'Groundwork AI Studio',
    tagline: 'Build datasets and train language models from random weights, on your own machines.',
    summary:
      'A local-first studio for training transformers from scratch on CPU, CUDA or Apple MPS — with its own model code, tokenizers and multi-machine DiLoCo training.',
    description: [
      'Groundwork is a desktop studio for the whole small-model loop: build a dataset, train a language model from random weights, evaluate it, and export it. The transformer modules, optimizers, tokenizers, checkpoint format and sampler are written in the project itself; PyTorch supplies autograd and little else.',
      'Training scales past one box. Machines on the same Tailscale network join a cluster and train together with DiLoCo, with coordinator failover, replicas and shard transfer. The web UI is served by a local API, so you can watch a run from any of your devices.',
      'It also covers evals and decontamination, LoRA, RL and RLHF modules, and export to Hugging Face and GGUF.',
    ],
    domains: ['ai'],
    status: 'active',
    year: 2026,
    stack: ['Python', 'PyTorch', 'TypeScript', 'Next.js', 'Tailscale'],
    highlights: [
      'From-scratch transformer, optimizer, tokenizer and sampler implementations',
      'Multi-machine DiLoCo training with coordinator failover',
      'Runs on CPU, NVIDIA CUDA and Apple MPS',
      'Evals, decontamination, LoRA / RL / RLHF, export to HF and GGUF',
      'Nightly end-to-end training runs in CI on macOS and Windows',
    ],
    repo: { owner: 'KingMoonk', name: 'TRAINER' },
    links: {
      docs: doc('KingMoonk/TRAINER', 'docs/distributed.md'),
    },
    releases: { owner: 'KingMoonk', name: 'TRAINER' },
    downloads: [
      {
        platform: 'macos',
        label: 'Download for macOS',
        url: gh('KingMoonk/TRAINER', '/releases/latest'),
        note: 'Unsigned build',
      },
      {
        platform: 'windows',
        label: 'Download for Windows',
        url: gh('KingMoonk/TRAINER', '/releases/latest'),
        note: 'Unsigned build',
      },
    ],
    role: 'Collaboration — Astrea is the lead contributor; the repository is owned by KingMoonk.',
    platforms: ['macos', 'windows'],
    featured: true,
    order: 2,
  },
  {
    slug: 'sda',
    name: 'Astrea SDA',
    tagline: 'Space domain awareness over a fast Rust API.',
    summary:
      'SGP4 propagation, ground-station pass prediction, relative motion and conjunction probability, with generated SDKs in five languages.',
    description: [
      'Astrea SDA is a Rust (Axum + Tokio) API for tracking objects in orbit. It keeps a catalog in sync with CelesTrak, propagates it with SGP4, and answers the questions operators actually ask: when is this satellite overhead, how fast is it moving relative to that one, and how likely are they to collide.',
      'It covers ground-station passes and visibility with Doppler, relative motion in the LVLH frame, state vectors and Keplerian elements, decay and re-entry watch, and Foster 2D conjunction probability. A Cesium viewer renders the results.',
      'Every release ships generated SDKs for TypeScript, Python, Go, Java and Rust, and the OpenAPI reference is published to GitHub Pages.',
    ],
    domains: ['autonomy', 'software'],
    status: 'active',
    year: 2021,
    stack: ['Rust', 'Axum', 'Tokio', 'SGP4', 'OpenAPI', 'Cesium'],
    highlights: [
      'SGP4 propagation with automatic CelesTrak TLE sync',
      'Pass and visibility prediction with Doppler',
      'Foster 2D conjunction collision probability',
      'Generated SDKs in TypeScript, Python, Go, Java and Rust',
    ],
    repo: { owner: 'mgwedd', name: 'astrea-sda-api' },
    subdomain: 'sda',
    links: {
      docs: 'https://mgwedd.github.io/astrea-sda-api/',
      changelog: gh('mgwedd/astrea-sda-api', '/releases'),
    },
    license: 'MIT or Apache-2.0',
    platforms: ['web'],
    featured: true,
    order: 4,
  },
  {
    slug: 'elenchos',
    name: 'ElenchOS',
    tagline: 'Verbatim, cited facts from deposition transcripts — extracted offline.',
    summary:
      'A native Mac app for litigators that pulls exact quotes from transcripts, each anchored to its page and line, without sending the record anywhere.',
    description: [
      'ElenchOS is a factual extraction engine for legal discovery, built for solo litigators and small firms. An embedded model with constrained decoding pulls verbatim quotes from deposition transcripts and anchors each one to its Page:Line location, so every fact can be checked against the record.',
      'Case data lives in encrypted briefcases on the Mac. The only network traffic is the update check, an opt-in model download, and the licence handshake.',
    ],
    domains: ['software', 'ai', 'security'],
    status: 'active',
    year: 2026,
    stack: ['Swift', 'SwiftUI', 'llama.cpp', 'CoreML', 'SQLite'],
    highlights: [
      'Constrained decoding keeps extractions verbatim',
      'Every fact cites its Page:Line source',
      'Encrypted, local-only case briefcases',
    ],
    repo: { owner: 'mgwedd', name: 'elenchOS', private: true },
    links: {},
    license: 'Proprietary',
    platforms: ['macos'],
    featured: true,
    order: 3,
  },
  {
    slug: 'eido',
    name: 'Eido',
    tagline: 'A local-first assistant that can’t act without your passkey.',
    summary:
      'An early-stage design for an assistant that proposes actions as intents and executes nothing external until you sign the approval.',
    description: [
      'Eido is an early build of a private executive assistant for the Mac. The design keeps the model local, so nothing goes to a hosted model. Most of the system is still specified rather than implemented.',
      'The design proposes every action as an intent. Low-risk, reversible actions run and can be undone; anything else waits in an approval queue until you sign it with a passkey. Only one component — the gate — holds credentials or performs external writes, and every step lands in an append-only audit log.',
      'The web app is planned to run on the Mac behind Tailscale, with no public surface.',
    ],
    domains: ['ai', 'security'],
    status: 'research',
    year: 2026,
    stack: ['TypeScript', 'Next.js', 'Tailscale'],
    highlights: [
      'Passkey-signed approvals for every external write',
      'Single credentialed gate with an append-only audit log',
      'Local inference, no public network surface',
    ],
    repo: { owner: 'mgwedd', name: 'eido' },
    links: {
      docs: doc('mgwedd/eido', 'docs/design.md'),
    },
    license: 'Source-available',
    platforms: ['macos', 'web'],
    featured: false,
    order: 6,
  },
];

/** Upstream work in open-source projects. */
export const contributions: Contribution[] = [
  {
    project: 'ArduPilot',
    title: 'autotest: close dataflash log filehandles',
    url: 'https://github.com/ArduPilot/ardupilot/pull/33839',
    state: 'merged',
    date: '2026-07-31',
  },
  {
    project: 'pymavlink',
    title: 'DFReader, mavutil: support use as context managers',
    url: 'https://github.com/ArduPilot/pymavlink/pull/1235',
    state: 'merged',
    date: '2026-07-31',
  },
  {
    project: 'ardupilot_ros',
    title: 'Recommend Gazebo Harmonic rosdep sources',
    url: 'https://github.com/ArduPilot/ardupilot_ros/pull/45',
    state: 'merged',
    date: '2026-07-27',
  },
  {
    project: 'Isaac Lab',
    title: 'fix(cli): CLI subcommands exiting 0 when the child command fails',
    url: 'https://github.com/isaac-sim/IsaacLab/pull/6758',
    state: 'merged',
    date: '2026-09-21',
  },
  {
    project: 'ArduPilot',
    title: 'AP_DDS: rate limit status texts driven by external nodes',
    url: 'https://github.com/ArduPilot/ardupilot/pull/33840',
    state: 'open',
  },
  {
    project: 'ArduPilot',
    title: 'AP_Mission: zero-initialize ChangeDetector command buffers',
    url: 'https://github.com/ArduPilot/ardupilot/pull/33861',
    state: 'open',
  },
  {
    project: 'ArduPilot wiki',
    title: 'Document DDS status text feedback and throttling',
    url: 'https://github.com/ArduPilot/ardupilot_wiki/pull/7889',
    state: 'open',
  },
  {
    project: 'rtk',
    title: 'fix(cli): stop aborting on non-UTF-8 argv bytes',
    url: 'https://github.com/rtk-ai/rtk/pull/3224',
    state: 'open',
  },
];

/** Design documents worth reading on their own. */
export const technicalNotes: TechnicalNote[] = [
  {
    title: 'HIPAA safeguards',
    projectSlug: 'aletheia',
    url: doc('mgwedd/aletheia', 'docs/HIPAA-SAFEGUARDS.md'),
    summary: 'How an offline clinical app maps onto the HIPAA Security Rule.',
  },
  {
    title: 'Encryption at rest',
    projectSlug: 'aletheia',
    url: doc('mgwedd/aletheia', 'docs/ENCRYPTION.md'),
    summary: 'AES-256-GCM with PBKDF2 key derivation (developer builds only), and what it does and doesn’t protect.',
  },
  {
    title: 'Fine-tuning without PHI',
    projectSlug: 'aletheia',
    url: doc('mgwedd/aletheia', 'docs/FINETUNING-PIPELINE.md'),
    summary: 'An offline LoRA plan built on synthetic data and grammar constraints.',
  },
  {
    title: 'Distributed training',
    projectSlug: 'groundwork',
    url: doc('KingMoonk/TRAINER', 'docs/distributed.md'),
    summary: 'Multi-machine DiLoCo training across a Tailscale network.',
  },
  {
    title: 'Orbit viewer',
    projectSlug: 'sda',
    url: doc('mgwedd/astrea-sda-api', 'docs/VIEWER.md'),
    summary: 'Rendering propagated orbits and conjunctions in Cesium.',
  },
  {
    title: 'The gate executor',
    projectSlug: 'eido',
    url: doc('mgwedd/eido', 'docs/gate-executor.md'),
    summary: 'One credentialed component, signed approvals, and an append-only log.',
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
export const getProjectBySubdomain = (sub: string) => projects.find((p) => p.subdomain === sub);
export const featuredProjects = () => projects.filter((p) => p.featured).sort((a, b) => a.order - b.order);
export const PROJECT_SUBDOMAINS = projects.flatMap((p) => (p.subdomain ? [p.subdomain] : []));
