'use client';
import CampaignForm from '@/components/campaign/campaign-form';
import { useApp } from '@/lib/app-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function CampaignPage() {
    const { user, isUserLoading } = useApp();

    if (isUserLoading) {
        return (
            <main className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </main>
        );
    }

    if (!user) {
        return (
            <main className="container mx-auto max-w-2xl py-8">
                <Alert>
                    <AlertTitle className='font-bold'>Authentication Required</AlertTitle>
                    <AlertDescription>
                        Please authenticate to initialize a new activity record.
                        <div className="mt-4">
                            <Button asChild>
                                <Link href="/login">Identify State</Link>
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            </main>
        )
    }

    return (
        <main className="container mx-auto max-w-2xl py-8">
            <CampaignForm />
        </main>
    )
}
