import { Injectable } from '@angular/core';

// Types for all the accessibility options
export interface AccessibilityOptions {
  reducedMotion: boolean;
  touchTargetExpand: boolean;
  highContrast: boolean;
  largeText: boolean;
  removeIcons: boolean;
  grayscale: boolean;
  nightShift: boolean;
}

// Default values for all accessibility options, when not yet set by user
export const defaultAccessibilityOptions: AccessibilityOptions = {
  reducedMotion: false,
  touchTargetExpand: false,
  highContrast: false,
  largeText: false,
  removeIcons: false,
  grayscale: false,
  nightShift: false,
};

/**
 * List of accessibility options, with a description, used for building the UI form
 */
export const accessibilityOptionsInfo: readonly {
  key: keyof AccessibilityOptions;
  label: string;
  className: string;
}[] = [
  { key: 'reducedMotion', label: 'Reduced Motion', className: 'a11y_reduced-motion' },
  {
    key: 'touchTargetExpand',
    label: 'Touch Target Expand',
    className: 'a11y_touch-target-expanded',
  },
  { key: 'highContrast', label: 'High Contrast', className: 'a11y_high-contrast' },
  { key: 'largeText', label: 'Large Type', className: 'a11y_large-type' },
  { key: 'removeIcons', label: 'Remove Icons', className: 'a11y_remove-icons' },
  { key: 'grayscale', label: 'No Color', className: 'a11y_grayscale' },
  { key: 'nightShift', label: 'Night Shift', className: 'a11y_no-blue-light' },
];

@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  // Key used to store accessibility options in localStorage
  private readonly LOCAL_STORAGE_KEY = 'accessibilityOptions';

  // Default values used (if localStorage is empty or corrupted)
  private readonly defaultOptions: AccessibilityOptions = defaultAccessibilityOptions;

  /**
   * Get the entire AccessibilityOptions object from localStorage,
   * falling back to defaults if parsing fails or key is missing.
   */
  public getAccessibilityOptions(): AccessibilityOptions {
    try {
      const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AccessibilityOptions>;
        return { ...this.defaultOptions, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to parse accessibilityOptions from localStorage:', error);
    }
    return { ...this.defaultOptions };
  }

  /**
   * Set the entire AccessibilityOptions object in localStorage
   * e.g. setAccessibilityOptions({ reducedMotion: true, highContrast: true, ... })
   */
  public setAccessibilityOptions(options: AccessibilityOptions): void {
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(options));
  }

  /**
   * Retrieve a single property with type inference
   * e.g. getAccessibilityProp('reducedMotion') => boolean
   */
  public getAccessibilityProp<K extends keyof AccessibilityOptions>(
    prop: K,
  ): AccessibilityOptions[K] {
    const allOptions = this.getAccessibilityOptions();
    return allOptions[prop];
  }

  /**
   * Update a single property and persist to localStorage
   * e.g. updateAccessibilityProp('highContrast', true)
   */
  public updateAccessibilityProp<K extends keyof AccessibilityOptions>(
    prop: K,
    value: AccessibilityOptions[K],
  ): void {
    const current = this.getAccessibilityOptions();
    const updated = { ...current, [prop]: value };
    this.setAccessibilityOptions(updated);
  }

  /**
   * Add appropriate class names, for each accessibility option,
   * to the document's <html> element.
   * These are then targeted by CSS to apply the modifications.
   */
  public applyAccessibilityClasses(): void {
    const options = this.getAccessibilityOptions();
    const htmlEl = document.documentElement;

    accessibilityOptionsInfo.forEach(({ key, className }) => {
      if (options[key]) {
        htmlEl.classList.add(className);
      } else {
        htmlEl.classList.remove(className);
      }
    });
  }
}
