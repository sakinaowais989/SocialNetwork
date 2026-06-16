'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface SocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  sendMessage: (data: any) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  sendMessage: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children, token }: { children: ReactNode; token: string }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    
    const ws = new WebSocket(`ws://localhost:5003/?token=${token}`);
    
    ws.onopen = () => {
      console.log('🔌 WebSocket Connected');
      setIsConnected(true);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket Disconnected');
      setIsConnected(false);
      setTimeout(() => {
        const newWs = new WebSocket(`ws://localhost:5003/?token=${token}`);
        setSocket(newWs);
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = (data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, sendMessage }}>
      {children}
    </SocketContext.Provider>
  );
};