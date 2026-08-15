import React from 'react';
import {Text} from 'react-native';

import {NavigationContainer} from '@react-navigation/native';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {render, fireEvent} from '@testing-library/react-native';

import {SettingsScreen} from '../SettingsScreen';

import {ROUTES} from '../../../utils/navigationConstants';

const Drawer = createDrawerNavigator();

const PalsScreen = () => <Text>Pals Screen</Text>;
const ModelsScreen = () => <Text>Models Screen</Text>;
const MemoryScreen = () => <Text>Memory Screen</Text>;
const KnowledgeScreen = () => <Text>Knowledge Screen</Text>;
const WorkspaceScreen = () => <Text>Workspace Screen</Text>;
const ToolScreen = () => <Text>Tool Screen</Text>;
const BenchmarkScreen = () => <Text>Benchmark Screen</Text>;
const GenerationSettingsScreen = () => <Text>Generation Settings Screen</Text>;
const AboutScreen = () => <Text>About Screen</Text>;

const TestNavigator = () => (
  <NavigationContainer>
    <Drawer.Navigator
      initialRouteName={ROUTES.SETTINGS}
      screenOptions={{headerShown: false}}
      drawerContent={() => null}>
      <Drawer.Screen name={ROUTES.SETTINGS} component={SettingsScreen} />
      <Drawer.Screen name={ROUTES.PALS} component={PalsScreen} />
      <Drawer.Screen name={ROUTES.MODELS} component={ModelsScreen} />
      <Drawer.Screen name={ROUTES.MEMORY} component={MemoryScreen} />
      <Drawer.Screen name={ROUTES.KNOWLEDGE} component={KnowledgeScreen} />
      <Drawer.Screen name={ROUTES.WORKSPACE} component={WorkspaceScreen} />
      <Drawer.Screen name={ROUTES.TOOL} component={ToolScreen} />
      <Drawer.Screen name={ROUTES.BENCHMARK} component={BenchmarkScreen} />
      <Drawer.Screen
        name={ROUTES.GENERATION_SETTINGS}
        component={GenerationSettingsScreen}
      />
      <Drawer.Screen name={ROUTES.APP_INFO} component={AboutScreen} />
    </Drawer.Navigator>
  </NavigationContainer>
);

describe('SettingsScreen entry hub', () => {
  it('renders all feature entries', () => {
    const {getByText} = render(<TestNavigator />);

    expect(getByText('Models')).toBeTruthy();
    expect(getByText('Memory')).toBeTruthy();
    expect(getByText('Knowledge')).toBeTruthy();
    expect(getByText('Workspace')).toBeTruthy();
    expect(getByText('Tools')).toBeTruthy();
    expect(getByText('Benchmark')).toBeTruthy();
    expect(getByText('Generation Settings')).toBeTruthy();
    expect(getByText('App Info')).toBeTruthy();
  });

  it('navigates to Models screen when Models entry is pressed', () => {
    const {getByText, queryByText} = render(<TestNavigator />);

    expect(queryByText('Models Screen')).toBeNull();

    fireEvent.press(getByText('Models'));

    expect(getByText('Models Screen')).toBeTruthy();
  });

  it('navigates to Generation Settings screen when its entry is pressed', () => {
    const {getByText, queryByText} = render(<TestNavigator />);

    expect(queryByText('Generation Settings Screen')).toBeNull();

    fireEvent.press(getByText('Generation Settings'));

    expect(getByText('Generation Settings Screen')).toBeTruthy();
  });
});
