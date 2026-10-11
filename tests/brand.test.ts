import { it, expect } from 'vitest';
import { brandText } from '../src/lib/brand';
import { readFileSync } from 'node:fs';
it('displays historical editorial branding with the public name',()=>{expect(brandText('Curadoria Clutchfolio / Clutch Coach')).toBe('Curadoria kyrven / kyrven coach');});
it('retains historical local preference and deployment keys',()=>{expect(readFileSync('src/components/experience/MotionSystem.tsx','utf8')).toContain('clutchfolio-motion');expect(readFileSync('src/components/Layout.tsx','utf8')).toContain('clutchfolio-theme');expect(readFileSync('supabase/config.toml','utf8')).toContain('clutch-coach');});
