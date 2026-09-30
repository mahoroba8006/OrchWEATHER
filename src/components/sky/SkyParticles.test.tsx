import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SKY_WEATHERS } from '../../lib/sky';
import { SkyParticles, particleCount } from './SkyParticles';

describe('SkyParticles', () => {
  it('never exceeds 60 particles', () => {
    for (const w of SKY_WEATHERS) for (const n of [true, false]) {
      expect(particleCount(w, n)).toBeLessThanOrEqual(60);
    }
  });
  it('uses the specified counts', () => {
    expect(particleCount('clear', false)).toBe(0);
    expect(particleCount('clear', true)).toBe(24);
    expect(particleCount('cloudy', false)).toBe(4);
    expect(particleCount('rain', false)).toBe(40);
    expect(particleCount('snow', false)).toBe(30);
    expect(particleCount('fog', false)).toBe(3);
    expect(particleCount('thunder', false)).toBe(40);
  });
  it('renders exactly particleCount particles', () => {
    const { container } = render(<SkyParticles weather="rain" isNight={false} paused={false} />);
    expect(container.querySelectorAll('.sky-particle')).toHaveLength(particleCount('rain', false));
  });
  it('renders a sun glow for daytime clear and a flash layer for thunder', () => {
    const clear = render(<SkyParticles weather="clear" isNight={false} paused={false} />);
    expect(clear.container.querySelector('.sky-sun')).not.toBeNull();
    const thunder = render(<SkyParticles weather="thunder" isNight={false} paused={false} />);
    expect(thunder.container.querySelector('.sky-flash')).not.toBeNull();
  });
  it('has a breathing layer that is not counted as a particle', () => {
    const { container } = render(<SkyParticles weather="snow" isNight={false} paused={false} />);
    expect(container.querySelector('.sky-breath')).not.toBeNull();
    expect(container.querySelector('.sky-breath')?.classList.contains('sky-particle')).toBe(false);
  });
  it('is deterministic across renders', () => {
    const a = render(<SkyParticles weather="snow" isNight={false} paused={false} />).container.innerHTML;
    const b = render(<SkyParticles weather="snow" isNight={false} paused={false} />).container.innerHTML;
    expect(a).toBe(b);
  });
  it('adds paused class when paused', () => {
    const { container } = render(<SkyParticles weather="snow" isNight={false} paused />);
    expect(container.firstElementChild?.className).toContain('sky-particles--paused');
  });
  it('is hidden from assistive tech', () => {
    const { container } = render(<SkyParticles weather="clear" isNight paused={false} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});
