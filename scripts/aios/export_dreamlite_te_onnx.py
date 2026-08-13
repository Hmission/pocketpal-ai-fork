# -*- coding: utf-8 -*-
"""导出 DreamLite TE(Qwen3-VL) language_model → ONNX，输出 hidden_states[-1]（per-token）。
端侧用 llama.rn tokenize 得 input_ids，再经此 ONNX(ORT) 取 hidden_states[-1] 作 UNet 条件。"""
import torch
from transformers import Qwen3VLForConditionalGeneration

TE = r"F:\pp\.tmp\dreamlite\te"
OUT = r"F:\pp\.tmp\dreamlite\onnx\te_hidden.onnx"


class TEWrap(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.lm = m.model.language_model

    def forward(self, input_ids, attention_mask):
        out = self.lm(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_hidden_states=True,
        )
        return out.hidden_states[-1]


def main():
    m = Qwen3VLForConditionalGeneration.from_pretrained(TE, torch_dtype=torch.float32)
    m.eval()
    w = TEWrap(m).eval()
    ids = torch.randint(0, 1000, (1, 46), dtype=torch.int64)
    mask = torch.ones(1, 46, dtype=torch.int64)
    with torch.no_grad():
        torch.onnx.export(
            w,
            (ids, mask),
            OUT,
            input_names=["input_ids", "attention_mask"],
            output_names=["hidden_states"],
            dynamic_axes={"input_ids": {1: "seq"}, "attention_mask": {1: "seq"}, "hidden_states": {1: "seq"}},
            opset_version=17,
            dynamo=True,
        )
    import os
    print("te_hidden.onnx", os.path.getsize(OUT) // 1024 // 1024, "MB")


if __name__ == "__main__":
    main()
