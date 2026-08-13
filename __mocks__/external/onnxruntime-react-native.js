/**
 * onnxruntime-react-native mock — Jest 环境无 native 实现。
 * 覆盖 dreamLiteEngine 用到的 API 面：InferenceSession.create/run/release、Tensor、env、install。
 */
const InferenceSession = {
  create: jest.fn().mockResolvedValue({
    run: jest.fn().mockResolvedValue({}),
    release: jest.fn().mockResolvedValue(undefined),
  }),
};

class Tensor {
  constructor(type, data, dims) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}

module.exports = {
  install: jest.fn(),
  env: {},
  Tensor,
  InferenceSession,
};
