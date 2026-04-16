export class FunctionalSlot {
  /**
   * @param {(event: object) => void} [onChange]
   */
  constructor(onChange = () => { }) {
    this.onChange = typeof onChange === "function" ? onChange : () => { };
  }

  /**
   * Runs when the observed slot changes.
   * 
   * @param {object} event
   */
  handleChange(event) {
    this.onChange(event);
  }
}
