import React, { useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import LibraryScreen from '../screens/LibraryScreen';
import PlayerScreen from '../screens/PlayerScreen';
import UploadScreen from '../screens/UploadScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { theme } from '../lib/theme';

const Tab = createBottomTabNavigator();

interface Document {
  id: string;
  title: string;
  format: string;
  status: string;
  audio_duration?: number;
  created_at: string;
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.bg,
    card: theme.bg,
    text: theme.paper,
    border: theme.hairline,
    primary: theme.gold,
  },
};

export default function Navigation() {
  // No auth gate — anyone can use the app; a session is minted on first upload.
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  if (selectedDocument) {
    return (
      <PlayerScreen
        document={selectedDocument}
        onBack={() => setSelectedDocument(null)}
      />
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.bg,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: theme.hairline,
          },
          headerTitleStyle: { color: theme.paper, fontWeight: '700' },
          headerTintColor: theme.paper,
          tabBarStyle: {
            backgroundColor: theme.bg,
            borderTopColor: theme.hairline,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: theme.gold,
          tabBarInactiveTintColor: theme.paper40,
        }}
      >
        <Tab.Screen
          name="Library"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>&#x1F4DA;</Text>
            ),
          }}
        >
          {() => <LibraryScreen onSelectDocument={setSelectedDocument} />}
        </Tab.Screen>
        <Tab.Screen
          name="Convert"
          component={UploadScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>&#x2B06;</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>&#x2699;</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
