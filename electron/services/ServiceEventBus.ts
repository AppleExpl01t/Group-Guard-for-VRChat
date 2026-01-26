import { EventEmitter } from 'events';
import log from 'electron-log';

const logger = log.scope('ServiceEventBus');

export type ServiceEventType = 
    | 'groups-updated'
    | 'auth-changed'; // Add more as needed

export interface ServiceEventPayloads {
    'groups-updated': { groups: { id: string; [key: string]: unknown }[] };
    'auth-changed': { userId: string | null };
}

class ServiceEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(20); // Allow more listeners than default
    }

    public emit<K extends keyof ServiceEventPayloads>(event: K, payload: ServiceEventPayloads[K]): boolean {
        logger.debug(`Emitting event: ${event}`);
        return super.emit(event, payload);
    }

    public on<K extends keyof ServiceEventPayloads>(event: K, listener: (payload: ServiceEventPayloads[K]) => void): this {
        return super.on(event, listener);
    }

    public off<K extends keyof ServiceEventPayloads>(event: K, listener: (payload: ServiceEventPayloads[K]) => void): this {
        return super.off(event, listener);
    }
}

export const serviceEventBus = new ServiceEventBus();
