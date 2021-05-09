export type ConnectionInfo = {
    offer: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidates?: RTCIceCandidate[];
    expiration_time: number;
    initiatorId: string;
}

export interface ISignalinService {
    fetchConnection(): Promise<ConnectionInfo>;
    createConnectionOffer({sdp, type}: RTCSessionDescriptionInit, initiatorId: string): Promise<void>;
    createConnectionAnswer({sdp, type}: RTCSessionDescriptionInit): Promise<void>;
    upsertIceCandidate(candidate: RTCIceCandidate): Promise<void>;
    disposeConnection(): Promise<void>;

    subscribeCandidatesChanges(callback: (candidates: RTCIceCandidate[]) => void): Function;
    watchSessionDescriptionUpdateOnce(reaction: 'offer' | 'answer'): Promise<RTCSessionDescriptionInit>;
}