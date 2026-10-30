
# Campus Hub UI Primitives (Phase 1 Design System)

Production-grade, accessible UI components built for **Campus Hub** using **Next.js (App Router)**, **TypeScript**, and **Tailwind CSS**.

---

## 🛠 Design System Rules & Architecture

1. **Strict TypeScript (No `React.FC`)**: Props are typed directly in function parameters to preserve clean generic inference.
2. **Ref Forwarding**: All native interactive elements (`Button`, `Input`, `Select`, `Card`, `Tabs`) use `React.forwardRef`.
3. **Palette Tokens**:
   - Primary: `violet-600` (hover: `violet-700`, ring: `violet-500/20`)
   - Surfaces: `bg-slate-50` / `dark:bg-slate-950` (Cards: `bg-white` / `dark:bg-slate-900`)
   - Borders: `border-slate-200/80` / `dark:border-slate-800`
4. **Hydration Protection**: All browser portals (`Modal`, `Toast`) include an SSR hydration guard to prevent Next.js hydration mismatches.
5. **WAI-ARIA Accessibility**: Automatic `useId()` bindings, keyboard roving focus for tabs, live regions for toasts, and focus trapping/scroll locking for dialogs.

---

## 📦 Component Library

### 1. Button (`Button.tsx`)
Interactive button supporting variant styling, sizes, loading spinners, and icon slots.

```tsx
import { Button } from '@/components/ui/Button';

// Variants: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
// Sizes: 'sm' | 'md' | 'lg'
<Button size="md" variant="primary">
  Publish Event
</Button>

// Loading State (disables pointer events and renders animated spinner)
<Button isLoading variant="primary">
  Saving Changes
</Button>

// Left and Right Icon Slots
<Button className="h-4 w-4" leftIcon="{<CalendarIcon" variant="outline"/>}
  rightIcon={<ArrowRightIcon className="h-4 w-4"/>}
>
  Select Date
</Button>

```

---

### 2. Badge (`Badge.tsx`)

Status indicators, campus category tags, and interactive toggle chips.

```tsx
import { Badge } from '@/components/ui/Badge';

// 1. Status Indicators
<Badge hasDot variant="success">Open Seats</Badge>
<Badge hasDot variant="warning">Ending Soon</Badge>
<Badge hasDot variant="danger">Session Full</Badge>
<Badge variant="neutral">Draft</Badge>

// 2. Campus Event Categories
// Variants: 'Tech' | 'Media' | 'Music' | 'Sports' | 'Business' | 'Gaming' | 'EventsOrganization'
<Badge variant="Tech">Tech</Badge>
<Badge variant="Media">Media</Badge>
<Badge variant="Music">Music</Badge>

// 3. Interactive Filter Chips (Solid violet when active)
<Badge 'Tech'} isActive="{selectedCategory" isClickable onClick="{()" variant="Tech"> setSelectedCategory('Tech')}
>
  Tech Filter
</Badge>

```

---

### 3. Input (`Input.tsx`)

Accessible input with auto-generated ID pairing, icons, helper text, and validation states.

```tsx
import { Input } from '@/components/ui/Input';

// Standard Input with auto useId binding
<Input helperText="Confirmation tickets are sent to this address." label="Campus Email" placeholder="login@student.1337.ma" required type="email"/>

// Validation Error State (Applies red ring and wires aria-invalid)
<Input error="Password must contain at least 8 characters." label="Password" type="password"/>

// Search Input with Left Icon
<Input className="h-4 w-4 text-slate-400" leftIcon="{<SearchIcon" placeholder="Search hackathons..."/>}
/>

```

---

### 4. Card (`Card.tsx`)

Compound component for event cards, feed items, and dashboard metrics.

```tsx
import {
  Card,
  CardBanner,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

<Card isHoverable>
  <CardBanner
    src="/mock/events/hackathon.png"   // local path, or a host allow-listed in next.config images.remotePatterns
    sizes="(min-width: 1024px) 33vw, 100vw"
    overlay={
      <>
        <Badge variant="Tech">Tech</Badge>
        <Badge hasDot variant="success">Open Seats</Badge>
      </>
    }
  />
  <CardHeader>
    <CardTitle>Inception: Docker Infrastructure</CardTitle>
    <CardDescription>Wednesday • 19:00 • Lab 2</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Multi-container setup with Nginx, MariaDB, and WordPress.</p>
  </CardContent>
  <CardFooter>
    <span className="text-xs text-slate-500">15 Seats Left</span>
    <Button size="sm" variant="primary">RSVP</Button>
  </CardFooter>
</Card>

```

---

### 5. Avatar & AvatarGroup (`Avatar.tsx`)

User profile pictures and club badges with automatic fallback initials and overflow count.

```tsx
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';

// Standalone Avatar
// Sizes: 'xs' (24px) | 'sm' (32px) | 'md' (40px) | 'lg' (48px) | 'xl' (64px)
// Status: 'online' | 'offline' | 'busy' | 'away'
<Avatar name="Mouad Najjar" size="md" src="[https://images.unsplash.com/photo-1534528741775-53994a69daeb](https://images.unsplash.com/photo-1534528741775-53994a69daeb)" status="online"/>

// Automatic Initials (Renders "MN" if image fails or is omitted)
<Avatar name="Mouad Najjar" size="md"/>

// Attendee Group with +N Overflow Counter
<AvatarGroup max="{3}" total="{42}">
  <Avatar name="Amine K"/>
  <Avatar name="Sarah M"/>
  <Avatar name="Yassine R"/>
  <Avatar name="Omar T"/>
</AvatarGroup>

```

---

### 6. Select (`Select.tsx`)

Accessible dropdown select supporting array-based configurations or custom child options.

```tsx
import { Select } from '@/components/ui/Select';

<Select label="Target Campus" onChange="{(e)" placeholder="Select audience..." value="{selectedCampus}"> setSelectedCampus(e.target.value)}
  options={[
    { value: 'all', label: 'All Campus (1337 & EMINES)' },
    { value: '1337', label: '1337 Only' },
    { value: 'emines', label: 'EMINES Only' },
  ]}
/>

```

---

### 7. Modal (`Modal.tsx`)

Accessible dialog rendered via `createPortal(..., document.body)` with scroll lock and Esc-key dismissal.

```tsx
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

<Modal isOpen="{isOpen}" onClose="{()"> setIsOpen(false)}
  size="md" // 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick={false} // Prevents closing on accidental outside clicks
>
  <ModalHeader onClose="{()"> setIsOpen(false)}>
    <ModalTitle>Confirm Reservation</ModalTitle>
    <ModalDescription>Reserve your seat for this workshop.</ModalDescription>
  </ModalHeader>

  <ModalContent>
    {/* Body scrolls internally up to max-h-[65vh] */}
    <p>Form inputs and details go here.</p>
  </ModalContent>

  <ModalFooter>
    <Button onClick="{()" variant="ghost"> setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="primary">
      Confirm Spot
    </Button>
  </ModalFooter>
</Modal>

```

---

### 8. Tabs (`Tabs.tsx`)

Segmented navigation controls with WAI-ARIA tab semantics and roving keyboard indices.

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

<Tabs defaultValue="all" onValueChange="{(val)"> console.log('Active tab:', val)}>
  <TabsList variant="segmented">
    <TabsTrigger value="all">All Campus</TabsTrigger>
    <TabsTrigger value="1337">1337 Benguerir</TabsTrigger>
    <TabsTrigger value="emines">EMINES School</TabsTrigger>
  </TabsList>

  <TabsContent value="all">
    <p>Combined campus events feed.</p>
  </TabsContent>
  <TabsContent value="1337">
    <p>1337 coding school sessions.</p>
  </TabsContent>
  <TabsContent value="emines">
    <p>EMINES industrial management events.</p>
  </TabsContent>
</Tabs>

```

---

### 9. Toast (`Toast.tsx`)

Imperative floating notifications with variant styles, countdown timers, and live region announcements.

#### 1. Setup Provider in Root Layout

```tsx
// src/app/layout.tsx
import { ToastProvider } from '@/components/ui/Toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

```

#### 2. Trigger Toasts from Any Component

```tsx
import { useToast } from '@/components/ui/Toast';

export function RSVPButton() {
  const { showToast } = useToast();

  const handleRSVP = () => {
    // Variants: 'success' | 'danger' | 'warning' | 'info'
    showToast({
      variant: 'success',
      title: 'RSVP Confirmed!',
      description: 'Your seat has been reserved. Check your inbox.',
      duration: 4000, // Optional duration in milliseconds
    });
  };

  return <button onClick={handleRSVP}>RSVP Now</button>;
}

```

---

### 10. Skeleton & CardSkeleton (`Skeleton.tsx`)

Pulsing placeholder wireframes to prevent Cumulative Layout Shift (CLS) during data fetching.

```tsx
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';

// Standalone Skeletons
// Variants: 'text' | 'circular' | 'rounded' | 'rectangular'
<Skeleton height="{40}" variant="circular" width="{40}"/>
<Skeleton variant="text" width="60%"/>
<Skeleton height="{36}" variant="rounded" width="{120}"/>

// Full Card Wireframe (Matches Card.tsx geometry 1:1)
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {isLoading ? (
    <>
      <CardSkeleton hasBanner="{true}"/>
      <CardSkeleton hasBanner="{true}"/>
      <CardSkeleton hasBanner="{false}"/>
    </>
  ) : (
    events.map((event) => <EventCard event="{event}" key="{event.id}"/>)
  )}
</div>

```

```

<FollowUp label="Ready to start Phase 2: Global Shell & Layout with the Navbar component?" query="Let's start Phase 2: Global Shell & Layout by building the responsive Navbar component."/>

```