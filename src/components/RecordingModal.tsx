import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (result: { items: any[], assumptions?: any[] }) => void;
}

const RecordingModal = ({ isOpen, onClose, onRecordingComplete }: RecordingModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsProcessing(true);
        processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Microphone Error",
        description: "Could not access the microphone. Please check your browser permissions."
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // This is the corrected step: Create the FormData object and append the audio file.
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      // Use the official Supabase client to invoke the edge function.
      const { data: result, error } = await supabase.functions.invoke('transcribe-and-analyze', {
        body: formData,
      });

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (!result || !Array.isArray(result.items)) {
        throw new Error('Invalid response structure from the transcription service.');
      }

      console.log('Transcription result:', result);
      onRecordingComplete(result);
      onClose(); // Close modal on success

    } catch (error) {
      console.error('Error processing audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      
      toast({
        variant: 'destructive',
        title: 'Transcription Failed',
        description: `Details: ${errorMessage}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm w-[92vw] sm:max-w-md pb-[env(safe-area-inset-bottom)]">
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
              <div className="w-28 h-28 sm:w-24 sm:h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
              <p className="text-muted-foreground text-center">
                Processing your statement...
              </p>
            </>
          ) : (
            <>
              <div 
                className={`w-28 h-28 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
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
