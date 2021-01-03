import firebase from 'firebase';
const db = firebase.firestore();

const COLLECTION_NAME = 'signaling';
const CONNECTION_TTL = 15 * 1000;

interface ConnectionInfo {
    offer: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidates?: RTCIceCandidate[];
    expiration_time: number;
    initiatorId: string;
}

export default class SignalinService {
    private collection = db.collection(COLLECTION_NAME);
    private connectionAccessor: string;

    constructor(connectionAccessor: string) {
        this.connectionAccessor = connectionAccessor;
    }

    createConnectionOffer({sdp, type}: RTCSessionDescriptionInit, initiatorId: string) {
        return this.collection
            .doc(this.connectionAccessor)
            .set({
                initiatorId,
                offer: {sdp, type},
                expiration_time: Date.now() + CONNECTION_TTL,
            });
    }

    createConnectionAnswer({sdp, type}: RTCSessionDescriptionInit) {
        return this.collection
            .doc(this.connectionAccessor)
            .set(
                {answer: {sdp, type}}, 
                {merge: true}
            );
    }

    upsertIceCandidate(candidate: RTCIceCandidate) {
        return this.collection
            .doc(this.connectionAccessor)
            .set(
                {candidates: firebase.firestore.FieldValue.arrayUnion(candidate.toJSON())}, 
                {merge: true}
            );
    }

    async fetchConnection(): Promise<ConnectionInfo> {
        const doc = await this.collection
            .doc(this.connectionAccessor)
            .get();

        return doc.data() as ConnectionInfo;
    }

    listenConnection(listener: (res: ConnectionInfo) => void): Function {
        return this.collection.doc(this.connectionAccessor)
            .onSnapshot(doc => listener(doc.data() as ConnectionInfo));
    }

    listenConnectionUpdateOnce(reaction: keyof ConnectionInfo): Promise<ConnectionInfo> {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.collection.doc(this.connectionAccessor)
                .onSnapshot(doc => {
                    const value = doc.data();
                    if (value && value[reaction]) {
                        unsubscribe();
                        resolve(value as ConnectionInfo);
                    }
                });
        });
    }

    disposeConnection() {
        // TODO Refactor
        return this.collection.doc(this.connectionAccessor).delete();
    }
}