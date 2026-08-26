/**
 * PerfMotion 演出层动效引擎测试（PERF_BENCHMARK_DESIGN §10.3）：
 * AnimatedNumber 追式缓动 / OdometerNumber 逐位翻滚 / ScoreReveal 揭幕。
 * 注：不用 fake timers——Animated（JS driver）与其冲突；断言挂载态
 * 与 N/A 诚实语义即可（动画过程真机走查验收）。
 */
import React from 'react';
import {render} from '../../../../jest/test-utils';
import {AnimatedNumber, OdometerNumber, ScoreReveal} from '../index';

describe('PerfMotion — 演出层动效引擎（§10.3）', () => {
  describe('AnimatedNumber（追式缓动）', () => {
    it('首帧直接显示目标值（不演假动画）', () => {
      const {getByTestId} = render(
        <AnimatedNumber
          value={4.231}
          format={n => `${n.toFixed(1)} GB`}
          testID="an"
        />,
      );
      expect(getByTestId('an').props.children).toBe('4.2 GB');
    });

    it('N/A（null/undefined/NaN）显占位符——诚实模式不编造', () => {
      const cases = [null, undefined, NaN];
      cases.forEach((v, i) => {
        const {getByTestId} = render(
          <AnimatedNumber value={v as never} testID={`an-${i}`} />,
        );
        expect(getByTestId(`an-${i}`).props.children).toBe('--');
      });
    });

    it('自定义占位符', () => {
      const {getByTestId} = render(
        <AnimatedNumber value={null} placeholder="N/A" testID="an-na" />,
      );
      expect(getByTestId('an-na').props.children).toBe('N/A');
    });
  });

  describe('OdometerNumber（逐位翻滚）', () => {
    it('数值按位渲染翻滚条带', () => {
      const {getByTestId} = render(<OdometerNumber value={88} testID="odo" />);
      expect(getByTestId('odo')).toBeTruthy();
    });

    it('N/A 显 "--"', () => {
      const {getByTestId} = render(
        <OdometerNumber value={null} testID="odo-na" />,
      );
      expect(getByTestId('odo-na').props.children).toHaveLength(2);
    });
  });

  describe('ScoreReveal（揭幕）', () => {
    it('挂载从 0 起步（狂飙起点）', () => {
      const {getByTestId} = render(
        <ScoreReveal value={88} color="#FFB300" testID="reveal" />,
      );
      expect(getByTestId('reveal-value').props.children).toBe('0');
    });

    it('自定义 format（小数分）', () => {
      const {getByTestId} = render(
        <ScoreReveal
          value={88.4}
          color="#FFB300"
          format={n => n.toFixed(1)}
          testID="reveal-fmt"
        />,
      );
      expect(getByTestId('reveal-fmt-value').props.children).toBe('0.0');
    });
  });
});
