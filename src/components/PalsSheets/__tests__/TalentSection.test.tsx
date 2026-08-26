import React from 'react';
import {useForm, FormProvider} from 'react-hook-form';

import {fireEvent, render, waitFor, within} from '../../../../jest/test-utils';
import {l10n} from '../../../locales';
import {L10nContext} from '../../../utils';
import {TalentSection} from '../TalentSection';
import type {PalFormData} from '../types';
import {
  talentRegistry,
  registerDefaultTalents,
  resetRegisteredFlag,
} from '../../../services/talents';

// Wrapper that provides FormProvider with react-hook-form context
const FormWrapper = ({
  defaultValues,
  children,
  onFormValues,
}: {
  defaultValues?: Partial<PalFormData>;
  children: React.ReactNode;
  onFormValues?: (getValues: () => PalFormData) => void;
}) => {
  const methods = useForm<PalFormData>({
    defaultValues: {
      name: '',
      talents: [],
      ...defaultValues,
    },
  });

  React.useEffect(() => {
    if (onFormValues) {
      onFormValues(methods.getValues as () => PalFormData);
    }
  }, [methods, onFormValues]);

  return (
    <L10nContext.Provider value={l10n.en}>
      <FormProvider {...methods}>{children}</FormProvider>
    </L10nContext.Provider>
  );
};

// B57-④：testID 落在 DS Switch 包装层，props.value 需从内层 Paper Switch（按 a11y label）读取
const innerSwitchValue = (
  getByTestId: (id: string) => any,
  name: 'render_html' | 'calculate' | 'datetime',
) =>
  within(getByTestId(`talent-switch-${name}`)).getByLabelText(
    l10n.en.components.palSheet.talentNames[name],
  ).props.value;

describe('TalentSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure talents are registered for each test
    talentRegistry.reset();
    resetRegisteredFlag();
    registerDefaultTalents();
  });

  afterAll(() => {
    talentRegistry.reset();
    resetRegisteredFlag();
  });

  describe('Rendering', () => {
    it('renders the talent section container', () => {
      const {getByTestId} = render(
        <FormWrapper>
          <TalentSection />
        </FormWrapper>,
      );

      expect(getByTestId('talent-section')).toBeTruthy();
    });

    it('renders a switch for each registered talent', () => {
      const {getByTestId} = render(
        <FormWrapper>
          <TalentSection />
        </FormWrapper>,
      );

      expect(getByTestId('talent-switch-render_html')).toBeTruthy();
      expect(getByTestId('talent-switch-calculate')).toBeTruthy();
      expect(getByTestId('talent-switch-datetime')).toBeTruthy();
      expect(getByTestId('talent-switch-web_search')).toBeTruthy();
      expect(getByTestId('talent-switch-read_url')).toBeTruthy();
    });

    it('renders talent item containers for each talent', () => {
      const {getByTestId} = render(
        <FormWrapper>
          <TalentSection />
        </FormWrapper>,
      );

      expect(getByTestId('talent-item-render_html')).toBeTruthy();
      expect(getByTestId('talent-item-calculate')).toBeTruthy();
      expect(getByTestId('talent-item-datetime')).toBeTruthy();
      expect(getByTestId('talent-item-web_search')).toBeTruthy();
      expect(getByTestId('talent-item-read_url')).toBeTruthy();
    });

    it('renders talent natural names from l10n', () => {
      const {getByText} = render(
        <FormWrapper>
          <TalentSection />
        </FormWrapper>,
      );

      const names = l10n.en.components.palSheet.talentNames;
      expect(getByText(names.render_html)).toBeTruthy();
      expect(getByText(names.calculate)).toBeTruthy();
      expect(getByText(names.datetime)).toBeTruthy();
      expect(getByText(names.web_search)).toBeTruthy();
      expect(getByText(names.read_url)).toBeTruthy();
    });

    it('renders talent descriptions from l10n', () => {
      const {getByText} = render(
        <FormWrapper>
          <TalentSection />
        </FormWrapper>,
      );

      const descriptions = l10n.en.components.palSheet.talentDescriptions;
      expect(getByText(descriptions.render_html)).toBeTruthy();
      expect(getByText(descriptions.calculate)).toBeTruthy();
      expect(getByText(descriptions.datetime)).toBeTruthy();
      expect(getByText(descriptions.web_search)).toBeTruthy();
      expect(getByText(descriptions.read_url)).toBeTruthy();
    });

    it('renders the section divider with "Talents" label', () => {
      const {getByText} = render(
        <FormWrapper>
          <TalentSection />
        </FormWrapper>,
      );

      expect(getByText(l10n.en.components.palSheet.talents)).toBeTruthy();
    });
  });

  describe('Switch toggling', () => {
    it('toggling a switch on adds the talent name to form value', async () => {
      let getFormValues: () => PalFormData;

      const {getByTestId} = render(
        <FormWrapper
          onFormValues={getValues => {
            getFormValues = getValues;
          }}>
          <TalentSection />
        </FormWrapper>,
      );

      // All switches should start off
      expect(getFormValues!().talents).toEqual([]);

      // Toggle calculate on（B57-④：testID 落在 DS Switch 包装层，valueChange 需打到内层 Paper Switch）
      fireEvent(
        within(getByTestId('talent-switch-calculate')).getByLabelText(
          l10n.en.components.palSheet.talentNames.calculate,
        ),
        'valueChange',
        true,
      );

      await waitFor(() => {
        expect(getFormValues!().talents).toContain('calculate');
      });
    });

    it('toggling a switch off removes the talent name from form value', async () => {
      let getFormValues: () => PalFormData;

      const {getByTestId} = render(
        <FormWrapper
          defaultValues={{talents: ['calculate', 'datetime']}}
          onFormValues={getValues => {
            getFormValues = getValues;
          }}>
          <TalentSection />
        </FormWrapper>,
      );

      // Verify initial state
      expect(getFormValues!().talents).toContain('calculate');
      expect(getFormValues!().talents).toContain('datetime');

      // Toggle calculate off
      fireEvent(
        within(getByTestId('talent-switch-calculate')).getByLabelText(
          l10n.en.components.palSheet.talentNames.calculate,
        ),
        'valueChange',
        false,
      );

      await waitFor(() => {
        const talents = getFormValues!().talents;
        expect(talents).not.toContain('calculate');
        expect(talents).toContain('datetime');
      });
    });

    it('toggling multiple switches on accumulates talent names', async () => {
      let getFormValues: () => PalFormData;

      const {getByTestId} = render(
        <FormWrapper
          onFormValues={getValues => {
            getFormValues = getValues;
          }}>
          <TalentSection />
        </FormWrapper>,
      );

      fireEvent(
        within(getByTestId('talent-switch-render_html')).getByLabelText(
          l10n.en.components.palSheet.talentNames.render_html,
        ),
        'valueChange',
        true,
      );

      await waitFor(() => {
        expect(getFormValues!().talents).toContain('render_html');
      });

      fireEvent(
        within(getByTestId('talent-switch-calculate')).getByLabelText(
          l10n.en.components.palSheet.talentNames.calculate,
        ),
        'valueChange',
        true,
      );

      await waitFor(() => {
        const talents = getFormValues!().talents;
        expect(talents).toContain('render_html');
        expect(talents).toContain('calculate');
      });
    });
  });

  describe('Pre-selected talents', () => {
    it('pre-selected talents from form default values show as enabled', () => {
      const {getByTestId} = render(
        <FormWrapper defaultValues={{talents: ['calculate', 'datetime']}}>
          <TalentSection />
        </FormWrapper>,
      );

      // calculate and datetime should be on
      expect(innerSwitchValue(getByTestId, 'calculate')).toBe(true);
      expect(innerSwitchValue(getByTestId, 'datetime')).toBe(true);

      // render_html should be off
      expect(innerSwitchValue(getByTestId, 'render_html')).toBe(false);
    });

    it('all talents pre-selected shows all switches as enabled', () => {
      const {getByTestId} = render(
        <FormWrapper
          defaultValues={{
            talents: ['render_html', 'calculate', 'datetime'],
          }}>
          <TalentSection />
        </FormWrapper>,
      );

      expect(innerSwitchValue(getByTestId, 'render_html')).toBe(true);
      expect(innerSwitchValue(getByTestId, 'calculate')).toBe(true);
      expect(innerSwitchValue(getByTestId, 'datetime')).toBe(true);
    });

    it('no pre-selected talents shows all switches as disabled', () => {
      const {getByTestId} = render(
        <FormWrapper defaultValues={{talents: []}}>
          <TalentSection />
        </FormWrapper>,
      );

      expect(innerSwitchValue(getByTestId, 'render_html')).toBe(false);
      expect(innerSwitchValue(getByTestId, 'calculate')).toBe(false);
      expect(innerSwitchValue(getByTestId, 'datetime')).toBe(false);
    });
  });
});
