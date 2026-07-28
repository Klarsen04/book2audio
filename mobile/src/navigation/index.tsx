import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { getAuthToken } from '../lib/api';
import LoginScreen from '../screens/LoginScreen';
import LibraryScreen from '../screens/LibraryScreen';
import PlayerScreen from '../screens/PlayerScreen';
import UploadScreen from '../screens/UploadScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

interface Document {
  id: string;
  title: string;
  format: string;
  status: string;
  duration?: number;
  created_at: string;
}

export default function Navigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = await getAuthToken();
    setIsAuthenticated(!!token);
    setCheckingAuth(false);
  };

  if (checkingAuth) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  if (selectedDocument) {
    return (
      <PlayerScreen
        document={selectedDocument}
        onBack={() => setSelectedDocument(null)}
      />
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a2e',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#2a2a4a',
          },
          headerTintColor: '#fff',
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: '#2a2a4a',
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: '#7c3aed',
          tabBarInactiveTintColor: '#888',
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
          name="Upload"
          component={UploadScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>&#x2B06;</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>&#x2699;</Text>
            ),
          }}
        >
          {() => <SettingsScreen onLogout={() => setIsAuthenticated(false)} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
