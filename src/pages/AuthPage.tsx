import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message
      });
    } else {
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signUp(email, password, displayName);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Registration Error", 
        description: error.message
      });
    } else {
      toast({
        title: "Registration Successful",
        description: "Very good. Please check your email to confirm your account."
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-butler-parchment p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-butler-heading text-4xl font-bold text-primary mb-2">
            Sir Dinewell
          </h1>
          <p className="text-muted-foreground text-butler-body">
            Your devoted nutritional butler awaits
          </p>
        </div>

        <Card className="card-butler">
          <CardHeader className="text-center">
            <CardTitle className="text-butler-heading text-2xl">
              Welcome, esteemed guest
            </CardTitle>
            <CardDescription className="text-butler-body">
              Please allow me to prepare your personal ledger
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-butler-body">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-butler-body">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full btn-butler text-butler-body font-medium"
                    disabled={loading}
                  >
                    {loading ? "Preparing your session..." : "Very good, sir. Sign me in."}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-butler-body">Display Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="How shall I address you?"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-butler-body">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-butler-body">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="A secure password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full btn-butler text-butler-body font-medium"
                    disabled={loading}
                  >
                    {loading ? "Establishing your ledger..." : "Excellent. Create my account."}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          "A gentleman's nutrition deserves meticulous attention."
        </p>
      </div>
    </div>
  );
};

export default AuthPage;