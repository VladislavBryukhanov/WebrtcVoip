import firebase from 'firebase';

const COLLECTION_NAME = 'signaling';
const db = firebase.firestore();

interface ConnectionInfo {
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
}

export default class SignalinService {
    private collection = db.collection(COLLECTION_NAME);
    private connectionAccessor: string;

    constructor(connectionAccessor: string) {
        this.connectionAccessor = connectionAccessor;
    }

    createConnectionOffer({type, sdp}: RTCSessionDescriptionInit) {
        console.log({type, sdp})
        return this.collection
            .doc(this.connectionAccessor)
            .set({offer: {type, sdp}});
    }

    createConnectionAnswer({type, sdp}: RTCSessionDescriptionInit) {
        return this.collection
            .doc(this.connectionAccessor)
            .set({answer: {type, sdp}}, {merge: true});
    }

    async fetchConnection(): Promise<ConnectionInfo> {
        const doc = await this.collection
            .doc(this.connectionAccessor)
            .get();

        return doc.data();
    }

    async listenReaction(reaction: keyof ConnectionInfo): Promise<ConnectionInfo> {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.collection.doc(this.connectionAccessor)
                .onSnapshot(doc => {
                    const value = doc.data();
                    if (value[reaction]) {
                        unsubscribe();
                        resolve(value);
                    }
                });
        });
    }

    disposeConnection() {
        return this.collection.doc(this.connectionAccessor).delete();
    }
}