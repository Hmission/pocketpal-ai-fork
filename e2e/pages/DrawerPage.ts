/**
 * Drawer/Navigation Page Object
 * Handles interactions with the navigation drawer
 *
 * The drawer is now a chat-session center: search + new chat + session list
 * + a Settings footer. All feature screens (Models/Pals/Memory/...) are
 * reached through the Settings hub page.
 *
 * Uses shared Selectors utility for consistent cross-platform selectors
 */

import {BasePage, ChainableElement} from './BasePage';
import {Selectors, byPartialText} from '../helpers/selectors';

declare const browser: WebdriverIO.Browser;

export class DrawerPage extends BasePage {
  /**
   * Get settings footer element (used to verify drawer is open)
   */
  get settingsTab(): ChainableElement {
    return this.getElement(Selectors.drawer.settingsTab);
  }

  /**
   * Get the new-chat button element
   */
  get newChatButton(): ChainableElement {
    return this.getElement(Selectors.drawer.newChatButton);
  }

  /**
   * Check if drawer is open (by checking if the Settings footer is visible)
   * The Settings footer is unique to the drawer and not a screen title.
   */
  async isOpen(): Promise<boolean> {
    return this.isElementDisplayed(Selectors.drawer.settingsTab, 3000);
  }

  /**
   * Wait for drawer to be fully open
   * The Settings footer is unique to the drawer (not a screen title).
   */
  async waitForOpen(timeout = 10000): Promise<void> {
    await this.waitForElement(Selectors.drawer.settingsTab, timeout);
  }

  /**
   * Wait for drawer to close
   * The Settings footer is unique to the drawer and won't appear elsewhere.
   */
  async waitForClose(timeout = 5000): Promise<void> {
    await this.waitForElementToDisappear(
      Selectors.drawer.settingsTab,
      timeout,
    );
  }

  /**
   * Tap a chat session in the sidebar by matching its title text
   */
  async tapSession(titleFragment: string): Promise<void> {
    await this.waitForOpen();
    await this.tap(byPartialText(titleFragment));
    await browser.pause(300);
    await this.waitForClose();
  }

  /**
   * Open the Settings hub through the drawer footer.
   */
  async openSettingsHub(): Promise<void> {
    await this.waitForOpen();
    await this.tap(Selectors.drawer.settingsTab);
    // Wait a moment for drawer animation then verify it closed
    await browser.pause(300);
    await this.waitForClose();
  }

  /**
   * Navigate to Models screen via the Settings hub.
   */
  async navigateToModels(): Promise<void> {
    await this.openSettingsHub();
    await this.tap(Selectors.settingsHub.modelsEntry);
    await browser.pause(300);
  }

  /**
   * Navigate to Pals screen via the Settings hub.
   */
  async navigateToPals(): Promise<void> {
    await this.openSettingsHub();
    await this.tap(Selectors.settingsHub.palsEntry);
    await browser.pause(300);
  }

  /**
   * Navigate to the Settings hub screen.
   */
  async navigateToSettings(): Promise<void> {
    await this.openSettingsHub();
  }

  /**
   * Return to the Chat screen.
   *
   * The drawer has no Chat entry anymore (chat is the default screen behind
   * the drawer), so dismiss the drawer by tapping outside of it. Drawer width
   * is ~320px on wide screens or 80% on narrow ones, so 85% of the screen
   * width is safely outside the drawer.
   */
  async navigateToChat(): Promise<void> {
    await this.waitForOpen();
    const {width, height} = await (
      browser as unknown as {
        getWindowSize: () => Promise<{width: number; height: number}>;
      }
    ).getWindowSize();
    await browser
      .action('pointer', {parameters: {pointerType: 'touch'}})
      .move({x: Math.floor(width * 0.85), y: Math.floor(height * 0.5)})
      .down()
      .up()
      .perform();
    await browser.pause(300);
    await this.waitForClose();
  }
}
