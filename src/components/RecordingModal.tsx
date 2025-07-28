import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (text: string) => void;
}

const RecordingModal = ({ isOpen, onClose, onRecordingComplete }: RecordingModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: "Unable to access microphone. Please check your permissions."
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        // TODO: Call transcription edge function
        // For now, simulate the transcription
        setTimeout(() => {
          const mockTranscription = "Two slices of whole grain toast with avocado and a scrambled egg";
          onRecordingComplete(mockTranscription);
          setIsProcessing(false);
          onClose();
        }, 2000);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        variant: "destructive",
        title: "Processing Error",
        description: "Unable to process your recording. Please try again."
      });
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-butler-heading text-center">
            At Your Leisure
          </DialogTitle>
          <DialogDescription className="text-center text-butler-body">
            Please describe your meal, and I shall transcribe it with utmost care.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-6">
          {isProcessing ? (
            <>
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
              <p className="text-muted-foreground text-center">
                Processing your statement...
              </p>
            </>
          ) : (
            <>
              <div 
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isRecording 
                    ? 'bg-destructive recording-pulse' 
                    : 'bg-primary hover:bg-primary/90 hover-elevate cursor-pointer'
                }`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 text-destructive-foreground" />
                ) : (
                  <Mic className="w-8 h-8 text-primary-foreground" />
                )}
              </div>
              
              <div className="text-center">
                <p className="font-medium text-butler-body">
                  {isRecording ? "Recording in progress..." : "Tap to begin recording"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isRecording ? "Tap the square to finish" : "Speak clearly and naturally"}
                </p>
              </div>
              
              {!isRecording && (
                <Button variant="outline" onClick={handleClose} className="mt-4">
                  Perhaps another time
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingModal;