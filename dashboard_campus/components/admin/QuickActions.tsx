"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export default function QuickActions() {
  const [isCreateEventOpen, setCreateEventOpen] = useState(false);
  const { showToast } = useToast();

  const handleCreateEvent = () => {
    setCreateEventOpen(false);
    showToast({
      title: "Event draft created",
      description: "The event form is ready to connect to your API.",
      variant: "success",
    });
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full" onClick={() => setCreateEventOpen(true)}>
          + Create New Event
        </Button>
        <Button className="w-full" variant="secondary">Invite Members</Button>
        <Button className="w-full" variant="secondary">Export Registrations (CSV)</Button>
      </CardContent>
    </Card>

    <Modal isOpen={isCreateEventOpen} onClose={() => setCreateEventOpen(false)} size="lg">
      <ModalHeader onClose={() => setCreateEventOpen(false)}>
        <ModalTitle>Create a new event</ModalTitle>
        <ModalDescription>Start an event draft for your club members.</ModalDescription>
      </ModalHeader>
      <ModalContent className="space-y-4">
        <Input label="Event name" placeholder="e.g. AI Buildathon & Demo Day" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Date" type="date" />
          <Select
            label="Category"
            placeholder="Choose a category"
            options={[
              { value: "tech", label: "Tech" },
              { value: "workshop", label: "Workshop" },
              { value: "social", label: "Social" },
            ]}
          />
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="secondary" onClick={() => setCreateEventOpen(false)}>Cancel</Button>
        <Button onClick={handleCreateEvent}>Save draft</Button>
      </ModalFooter>
    </Modal>
    </>
  );
}
