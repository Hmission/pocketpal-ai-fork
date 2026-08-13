# -*- coding: utf-8 -*-
"""重导 DreamLite UNet ONNX，含 encoder_attention_mask（对齐官方 pipeline）。"""
import os
import sys

import torch


def main():
    # 复用 shim 包导入 DreamLiteUNetModel
    sys.path.insert(0, r"F:\pp\.tmp\dreamlite\pkg")
    from dreamlite.models.unets.unet_2d_condition_mobile import DreamLiteUNetModel

    unet = DreamLiteUNetModel.from_pretrained(
        r"F:\pp\.tmp\dreamlite\ckpt", subfolder="unet"
    )
    unet.eval()

    class W(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.u = unet

        def forward(self, sample, timestep, enc, mask, time_ids):
            return self.u(
                sample,
                timestep,
                enc,
                encoder_attention_mask=mask,
                added_cond_kwargs={"time_ids": time_ids},
                return_dict=False,
            )[0]

    w = W().eval()
    args = (
        torch.randn(1, 4, 128, 256),
        torch.tensor([500.0]),
        torch.randn(1, 77, 2048),
        torch.ones(1, 77, dtype=torch.int64),
        torch.randn(1, 2),
    )
    out = r"F:\pp\.tmp\dreamlite\onnx\unet_masked.onnx"
    with torch.no_grad():
        torch.onnx.export(
            w,
            args,
            out,
            input_names=["sample", "timestep", "encoder_hidden_states", "encoder_attention_mask", "time_ids"],
            output_names=["noise_pred"],
            dynamic_axes={
                "sample": {2: "h", 3: "w"},
                "encoder_hidden_states": {1: "seq"},
                "encoder_attention_mask": {1: "seq"},
                "noise_pred": {2: "h", 3: "w"},
            },
            opset_version=17,
            dynamo=False,
        )
    print("unet_masked.onnx", os.path.getsize(out) // 1024 // 1024, "MB")
    print("data", os.path.getsize(out + ".data") // 1024 // 1024, "MB")


if __name__ == "__main__":
    main()
