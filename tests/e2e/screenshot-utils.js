/**
 * Screenshot Utilities for Puppeteer Tests
 * 
 * Provides helper functions for taking various types of screenshots
 */

import { join } from 'path';
import fs from 'fs';

export class ScreenshotHelper {
  constructor(page, screenshotsDir) {
    this.page = page;
    this.screenshotsDir = screenshotsDir;
    this.counter = 0;
    
    // Ensure directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  }

  /**
   * Take a full page screenshot
   */
  async fullPage(name) {
    const filename = this._getFilename(name);
    await this.page.screenshot({ 
      path: filename, 
      fullPage: true 
    });
    console.log(`📸 Full page screenshot: ${filename}`);
    return filename;
  }

  /**
   * Take a viewport screenshot (visible area only)
   */
  async viewport(name) {
    const filename = this._getFilename(name);
    await this.page.screenshot({ 
      path: filename, 
      fullPage: false 
    });
    console.log(`📸 Viewport screenshot: ${filename}`);
    return filename;
  }

  /**
   * Take a screenshot of a specific element
   */
  async element(selector, name) {
    const element = await this.page.$(selector);
    if (!element) {
      console.warn(`⚠️  Element not found: ${selector}`);
      return null;
    }
    
    const filename = this._getFilename(name);
    await element.screenshot({ path: filename });
    console.log(`📸 Element screenshot: ${filename}`);
    return filename;
  }

  /**
   * Take a screenshot with a highlight around an element
   */
  async elementWithHighlight(selector, name, options = {}) {
    const {
      color = 'red',
      width = 3,
      padding = 10
    } = options;

    // Add highlight
    await this.page.evaluate((sel, borderColor, borderWidth, pad) => {
      const element = document.querySelector(sel);
      if (element) {
        element.style.outline = `${borderWidth}px solid ${borderColor}`;
        element.style.outlineOffset = `${pad}px`;
      }
    }, selector, color, width, padding);

    const filename = await this.viewport(name);

    // Remove highlight
    await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (element) {
        element.style.outline = '';
        element.style.outlineOffset = '';
      }
    }, selector);

    return filename;
  }

  /**
   * Take a comparison screenshot (before/after)
   */
  async comparison(name, beforeAction, afterAction) {
    const beforeFilename = this._getFilename(`${name}-before`);
    await this.page.screenshot({ path: beforeFilename, fullPage: false });
    console.log(`📸 Before screenshot: ${beforeFilename}`);

    if (beforeAction) await beforeAction();

    const afterFilename = this._getFilename(`${name}-after`);
    await this.page.screenshot({ path: afterFilename, fullPage: false });
    console.log(`📸 After screenshot: ${afterFilename}`);

    return { before: beforeFilename, after: afterFilename };
  }

  /**
   * Take a screenshot with custom clip region
   */
  async clip(clipRegion, name) {
    const filename = this._getFilename(name);
    await this.page.screenshot({ 
      path: filename, 
      clip: clipRegion 
    });
    console.log(`📸 Clipped screenshot: ${filename}`);
    return filename;
  }

  /**
   * Take a screenshot with annotations
   */
  async annotated(name, annotations = []) {
    // Add annotations to page
    await this.page.evaluate((annots) => {
      const container = document.createElement('div');
      container.id = 'puppeteer-annotations';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.zIndex = '999999';
      container.style.pointerEvents = 'none';
      
      annots.forEach(({ x, y, text, color = 'red' }) => {
        const annotation = document.createElement('div');
        annotation.style.position = 'absolute';
        annotation.style.left = `${x}px`;
        annotation.style.top = `${y}px`;
        annotation.style.background = color;
        annotation.style.color = 'white';
        annotation.style.padding = '4px 8px';
        annotation.style.borderRadius = '4px';
        annotation.style.fontSize = '14px';
        annotation.style.fontWeight = 'bold';
        annotation.textContent = text;
        container.appendChild(annotation);
      });
      
      document.body.appendChild(container);
    }, annotations);

    const filename = await this.viewport(name);

    // Remove annotations
    await this.page.evaluate(() => {
      const container = document.getElementById('puppeteer-annotations');
      if (container) container.remove();
    });

    return filename;
  }

  _getFilename(name) {
    this.counter++;
    const paddedCounter = String(this.counter).padStart(2, '0');
    const sanitizedName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return join(this.screenshotsDir, `${paddedCounter}-${sanitizedName}.png`);
  }

  /**
   * Reset counter
   */
  reset() {
    this.counter = 0;
  }
}

