import './firebase-init';
import firebase from 'firebase';
import {ISignalinService, ConnectionInfo} from '../signaling.interface';
const db = firebase.firestore();

const COLLECTION_NAME = 'signaling';
const CONNECTION_TTL = 15 * 1000;

export default class SignalinService implements ISignalinService {
    private collection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>;
    private connectionAccessor: string;

    constructor(connectionAccessor: string) {
        this.connectionAccessor = connectionAccessor;
        this.collection = db.collection(COLLECTION_NAME); 
    }

    async fetchConnection(): Promise<ConnectionInfo> {
        const doc = await this.collection
            .doc(this.connectionAccessor)
            .get();

        return doc.data() as ConnectionInfo;
    }

    createConnectionOffer({sdp, type}: RTCSessionDescriptionInit, initiatorId: string): Promise<void> {
        return this.collection
            .doc(this.connectionAccessor)
            .set({
                initiatorId,
                offer: {sdp, type},
                expiration_time: Date.now() + CONNECTION_TTL,
            });
    }

    createConnectionAnswer({sdp, type}: RTCSessionDescriptionInit): Promise<void> {
        return this.collection
            .doc(this.connectionAccessor)
            .set(
                {answer: {sdp, type}}, 
                {merge: true}
            );
    }

    upsertIceCandidate(candidate: RTCIceCandidate): Promise<void> {
        return this.collection
            .doc(this.connectionAccessor)
            .set(
                {candidates: firebase.firestore.FieldValue.arrayUnion(candidate.toJSON())}, 
                {merge: true}
            );
    }

    disposeConnection(): Promise<void> {
        // TODO Refactor
        return this.collection.doc(this.connectionAccessor).delete();
    }

    subscribeCandidatesChanges(callback: (candidates: RTCIceCandidate[]) => void): Function {
        return this.collection.doc(this.connectionAccessor)
            .onSnapshot(doc => {
                const con = doc.data() as ConnectionInfo;

                if (con && con.candidates) {
                    callback(con.candidates);
                }
            });
    }

    // ????
    watchSessionDescriptionUpdateOnce(reaction: 'offer' | 'answer'): Promise<RTCSessionDescriptionInit> {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.collection.doc(this.connectionAccessor)
                .onSnapshot(doc => {
                    const value = doc.data() as ConnectionInfo;
                    if (value && value[reaction]) {
                        unsubscribe();
                        resolve(value[reaction]);
                    }
                }, reject);
        });
    }
}