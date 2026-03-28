const flows = new Map();

export const flowService = {
  /**
   * @param {number} userId
   * @param {{ type: string, payload?: Record<string, unknown> }} flow
   */
  set(userId, flow) {
    flows.set(userId, flow);
  },
  get(userId) {
    return flows.get(userId);
  },
  clear(userId) {
    flows.delete(userId);
  },
};
