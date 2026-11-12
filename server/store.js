import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = path.join(root, 'data', 'incidents.json');
const MAX_HISTORY = 150;

export class IncidentStore {
  constructor() {
    this.db = { incidents: [], demoResetAt: null };
    try {
      const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (Array.isArray(value.incidents)) this.db.incidents = value.incidents;
      if (typeof value.demoResetAt === 'string') this.db.demoResetAt = value.demoResetAt;
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('Could not load saved incident history:', err.message);
    }
  }

  get incidents() { return this.db.incidents; }

  get active() {
    return this.db.incidents.find(x => x.status === 'WAITING' || x.status === 'ESCALATED') ?? null;
  }

  byId(id) { return this.db.incidents.find(x => x.id === id) ?? null; }

  add(incident) {
    this.db.incidents.unshift(incident);
    this.db.incidents.length = Math.min(this.db.incidents.length, MAX_HISTORY);
    this.save();
  }

  update(id, fields) {
    const incident = this.byId(id);
    if (!incident) return null;
    Object.assign(incident, fields);
    this.save();
    return incident;
  }

  // Chat messages confirmed as scams are "deleted" from the senior's demo WhatsApp.
  // A demo reset restores them without erasing the incident history.
  deletedMessageIds() {
    const since = this.db.demoResetAt ? Date.parse(this.db.demoResetAt) : 0;
    return [...new Set(this.db.incidents
      .filter(i => i.decision === 'BLOCKED' && i.messageId && Date.parse(i.createdAt) > since)
      .map(i => i.messageId))];
  }

  // Latest decision (SAFE / BLOCKED) for a website, so a link anak already reviewed is not asked about again.
  // Real WhatsApp messages cannot be deleted by another app, so remembering blocked sites is the protection.
  rememberedDecision(domain) {
    const since = this.db.demoResetAt ? Date.parse(this.db.demoResetAt) : 0;
    const hit = this.db.incidents.find(i => i.status === 'RESOLVED' && i.domain === domain && Date.parse(i.createdAt) > since);
    return hit ? hit.decision : null;
  }

  resetDemo() {
    this.db.demoResetAt = new Date().toISOString();
    this.save();
  }

  stats() {
    return {
      scannedThreats: this.db.incidents.length,
      resolved: this.db.incidents.filter(i => i.status === 'RESOLVED').length,
      escalated: this.db.incidents.filter(i => Boolean(i.escalatedAt)).length
    };
  }

  save() {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const temp = `${filename}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.db, null, 2), { mode: 0o600 });
    fs.renameSync(temp, filename);
  }
}
