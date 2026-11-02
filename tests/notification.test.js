import { jest } from '@jest/globals';
import { WebSocketDelivery, NotificationDispatcher, wss, mqttClient } from '../index.js';

describe('Notification System Logic', () => {
    let dispatcher;

    beforeEach(() => {
        dispatcher = new NotificationDispatcher();
        dispatcher.registerStrategy(new WebSocketDelivery());
    });

    // APAGAR CONEXIONES
    afterAll(() => {
        wss.close();
        mqttClient.end(true); // fuerza el cierre
    });

    it('Debe fallar al despachar si el usuario no está conectado', async () => {
        const payload = { receptorId: "11", contenido: { titulo: "Alerta" } };
        const results = await dispatcher.dispatch(payload);
        
        expect(results[0].delivered).toBe(false);
    });

    it('Debe enviar el mensaje con éxito si el usuario está conectado', async () => {
        // Simulamos un socket de usuario vivo (readyState = 1)
        const mockSocket = { readyState: 1, send: jest.fn() };
        dispatcher.activeConnections.set("99", mockSocket);
        
        const payload = { receptorId: "99", contenido: { titulo: "Alerta exitosa" } };
        const results = await dispatcher.dispatch(payload);
        
        expect(results[0].delivered).toBe(true);
        expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify(payload));
    });

    it('Debe registrar sesión al recibir INIT_SESSION por WebSocket', () => {
        // Simulamos un cliente WebSocket conectándose
        const mockWs = { 
            send: jest.fn(), 
            on: jest.fn((event, callback) => {
                if (event === 'message') {
                    callback(JSON.stringify({ type: 'INIT_SESSION', userId: "33" }));
                }
            }) 
        };
        
        // Disparamos el evento de nueva conexión
        wss.emit('connection', mockWs);
        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ status: "CONNECTED", userId: "33" }));
    });

    it('Debe procesar un mensaje entrante desde el broker MQTT', () => {
        const fakePayload = JSON.stringify({ receptorId: "22", contenido: "Mensaje MQTT" });
        
        // Disparamos el evento como si un mensaje real llegara por MQTT
        expect(() => {
            mqttClient.emit('message', 'sigi/notifications/test', Buffer.from(fakePayload));
        }).not.toThrow();
    });
});