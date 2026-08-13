# -*- coding: utf-8 -*-
"""验证 DreamLite TE(Qwen3-VL) 能输出 per-token hidden_states[-1]（复刻 encode_prompt）。"""
import torch
from transformers import Qwen3VLForConditionalGeneration, AutoTokenizer

TE = r"F:\pp\.tmp\dreamlite\te"
DROP_IDX = 34
IM_START = "<" + "|im_start|" + ">"
IM_END = "<" + "|im_end|" + ">"
SYS = (
    "Describe the image by detailing the color, shape, size, texture, "
    "quantity, text, spatial relationships of the objects and background:"
)


def build_text(prompt):
    return (
        IM_START + "system\n" + SYS + IM_END + "\n"
        + IM_START + "user\n" + prompt + IM_END + "\n"
        + IM_START + "assistant\n"
    )


def main():
    tok = AutoTokenizer.from_pretrained(TE)
    m = Qwen3VLForConditionalGeneration.from_pretrained(TE, torch_dtype=torch.float32)
    m.eval()
    text = build_text("a red apple on a wooden table")
    ids = tok(text, return_tensors="pt")
    with torch.no_grad():
        out = m.model.language_model(
            input_ids=ids["input_ids"],
            attention_mask=ids["attention_mask"],
            output_hidden_states=True,
        )
    hs = out.hidden_states[-1]
    print("hidden_states[-1] shape:", tuple(hs.shape))
    n = hs.shape[1]
    print("tokens:", n, "drop:", DROP_IDX, "kept:", n - DROP_IDX)


if __name__ == "__main__":
    main()
