// 'use client';

// import React, { useState } from 'react';
// import { Select } from '@/components/ui/Select';
// import { Button } from '@/components/ui/Button';

// export default function Home() {
//   const [department, setDepartment] = useState('all');
//   const [category, setCategory] = useState('');

//   const departmentOptions = [
//     { value: 'all', label: 'All Campus (1337 & EMINES)' },
//     { value: '1337', label: '1337 Coding School Only' },
//     { value: 'emines', label: 'EMINES School of Industrial Management' },
//   ];

//   const categoryOptions = [
//     { value: 'tech', label: 'Tech & Coding' },
//     { value: 'media', label: 'Media & Filmmaking' },
//     { value: 'music', label: 'Music & Audio' },
//     { value: 'sports', label: 'Sports & Athletics' },
//     { value: 'business', label: 'Business & Leadership' },
//     { value: 'gaming', label: 'Gaming & Esports' },
//   ];

//   return (
//     <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 max-w-xl mx-auto space-y-6">
//       <div>
//         <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
//           Select Verification Bench
//         </h1>
//         <p className="text-sm text-slate-500">
//           Testing custom chevron, accessible labels, options mapping, and validation errors.
//         </p>
//       </div>

//       {/* 1. Standard Select with Preselected Value */}
//       <Select
//         label="Campus Filter"
//         options={departmentOptions}
//         value={department}
//         onChange={(e) => setDepartment(e.target.value)}
//         helperText="Filters the event feed by university department."
//       />

//       {/* 2. Select with Placeholder & Options */}
//       <Select
//         label="Event Category"
//         placeholder="Choose a category..."
//         options={categoryOptions}
//         value={category}
//         onChange={(e) => setCategory(e.target.value)}
//       />

//       {/* 3. Validation Error State */}
//       <Select
//         label="Host Club"
//         placeholder="Select organizing club..."
//         error="You must select a verified campus club to host this event."
//       >
//         <option value="leet-frame">Leet Frame</option>
//         <option value="melody-minds">Melody Minds</option>
//         <option value="leet-music">LEET Music</option>
//       </Select>

//       {/* 4. Disabled State */}
//       <Select
//         label="Academic Year"
//         disabled
//         options={[{ value: '2026', label: '2026 - 2027 Academic Year' }]}
//         helperText="Academic terms are managed automatically by the campus directory."
//       />

//       <Button variant="primary" className="w-full">
//         Save Selection
//       </Button>
//     </main>
//   );
// }

//---------------------------------AVATAR----------------------------
// 'use client';

// import React from 'react';
// import { Avatar, AvatarGroup } from '@/components/ui/Avatar';

// export default function Home() {
//   return (
//     <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 max-w-2xl mx-auto space-y-8">
//       <div>
//         <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
//           Avatar Verification Bench
//         </h1>
//         <p className="text-sm text-slate-500">
//           Testing sizes, status rings, 404 fallback to initials, and attendee stacks.
//         </p>
//       </div>

//       {/* 1. Size Spectrum */}
//       <section className="space-y-3">
//         <h2 className="text-xs font-bold uppercase text-slate-400">1. Sizing Spectrum</h2>
//         <div className="flex items-center gap-3">
//           <Avatar size="xs" name="hmed zal" />
//           <Avatar size="sm" name="Mouad Najjar" />
//           <Avatar size="md" name="Mouad Najjar" status="online" />
//           <Avatar size="lg" name="Mouad Najjar" status="busy" />
//           <Avatar size="xl" name="Mouad Najjar" status="away" />
//         </div>
//       </section>

//       {/* 2. Real Image vs Fallback Resilience */}
//       <section className="space-y-3">
//         <h2 className="text-xs font-bold uppercase text-slate-400">2. Image & Fallback Handling</h2>
//         <div className="flex items-center gap-4">
//           {/* Valid Image */}
//           <Avatar
//             src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
//             name="Sarah Connor"
//             size="lg"
//             status="online"
//           />

//           {/* Broken Image (Simulated 404 -> Should gracefully show "AK" initials) */}
//           <Avatar
//             src="https://invalid-domain-does-not-exist.org/broken.jpg"
//             name="Amine Kabbaj"
//             size="lg"
//             status="offline"
//           />

//           {/* No Image Provided (Pure initials) */}
//           <Avatar name="Leet Frame" size="lg" status="online" />

//           {/* No Name, No Image (Generic Silhouette) */}
//           <Avatar size="lg" />
//         </div>
//       </section>

//       {/* 3. Attendee Group Stack */}
//       <section className="space-y-3">
//         <h2 className="text-xs font-bold uppercase text-slate-400">3. Attendee Group Stack</h2>
//         <AvatarGroup max={2} total={50}>
//           <Avatar name="Ali Ben" />
//           <Avatar name="samza sazi" />
//           <Avatar name="Badr Alami" />
//           <Avatar name="Saad Idrissi" />
//           <Avatar name="Jalil Mansour" />
//         </AvatarGroup>
//       </section>
//     </main>
//   );
// }

// 'use client';

// import React from 'react';
// import {
//   Card,
//   CardBanner,
//   CardHeader,
//   CardTitle,
//   CardDescription,
//   CardContent,
//   CardFooter,
// } from '@/components/ui/Card';
// import { Badge } from '@/components/ui/Badge';
// import { Button } from '@/components/ui/Button';

// export default function Home() {
//   return (
//     <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 max-w-4xl mx-auto space-y-8">
//       <div>
//         <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
//           Card with Banner Verification Bench
//         </h1>
//         <p className="text-sm text-slate-500">
//           Testing event cards with flyer covers, image hover-zoom, and floating overlay badges.
//         </p>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         {/* Card 1: Event with Image Flyer & Floating Badges */}
//         <Card isHoverable>
//           <CardBanner
//             src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80"
//             alt="Hackathon event banner"
//             overlay={
//               <>
//                 <Badge variant="Tech">Tech</Badge>
//                 <Badge variant="success" hasDot>Confirmed</Badge>
//               </>
//             }
//           />
//           <CardHeader>
//             <CardTitle>1337 x EMINES Winter Hackathon</CardTitle>
//             <CardDescription>Saturday, Nov 12 • 09:00 - 21:00 • Agora Hall</CardDescription>
//           </CardHeader>
//           <CardContent>
//             <p className="text-slate-600 dark:text-slate-300">
//               Build functional AI prototypes and full-stack campus tools in 12 hours. Mentorship and food provided.
//             </p>
//           </CardContent>
//           <CardFooter className="pt-3">
//             <span className="text-xs text-slate-500">64 / 80 Registered</span>
//             <Button size="sm" variant="primary">RSVP</Button>
//           </CardFooter>
//         </Card>

//         {/* Card 2: Event without Image (Fallback Gradient Banner) */}
//         <Card isHoverable>
//           <CardBanner
//             overlay={
//               <>
//                 <Badge variant="Media">Media</Badge>
//                 <Badge variant="warning" hasDot>Starts in 2h</Badge>
//               </>
//             }
//           />
//           <CardHeader>
//             <CardTitle>Cinematography & Lighting Workshop</CardTitle>
//             <CardDescription>Tonight • 19:30 • Media Lab</CardDescription>
//           </CardHeader>
//           <CardContent>
//             <p className="text-slate-600 dark:text-slate-300">
//               Practical framing, key-light setups, and color space fundamentals for short film production.
//             </p>
//           </CardContent>
//           <CardFooter className="pt-3">
//             <span className="text-xs text-slate-500">18 / 20 Registered</span>
//             <Button size="sm" variant="secondary">Details</Button>
//           </CardFooter>
//         </Card>
//       </div>

//     </main>
//   );
// }
// // ****************************************** INPUT LABEL
// 'use client';

// import React, { useState } from 'react';
// import { Input } from '@/components/ui/Input';
// import { Button } from '@/components/ui/Button';

// export default function Home() {
//   const [showPassword, setShowPassword] = useState(false);
//   const [searchQuery, setSearchQuery] = useState('');

//   return (
//     <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 space-y-6 max-w-xl mx-auto">
//       <div>
//         <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
//           Input Verification Bench
//         </h1>
//         <p className="text-sm text-slate-500">
//           Testing labels, left/right icons, helper notes, accessibility IDs, and validation errors.
//         </p>
//       </div>

//       {/* 1. Default Text Input */}
//       <Input
//         label="Event Title"
//         placeholder="e.g. 1337 Pool Welcome Hackathon"
//         helperText="Keep titles under 60 characters for card views."
//       />

//       {/* 2. Leading Icon (Search Bar) */}
//       <Input
//         label="Search Feed"
//         placeholder="Search workshops, hackathons, jams..."
//         value={searchQuery}
//         onChange={(e) => setSearchQuery(e.target.value)}
//         leftIcon={<span className="text-base">🔍</span>}
//       />

//       {/* 3. Trailing Interactive Action (Password Visibility) */}
//       <Input
//         label="Password"
//         type={showPassword ? 'text' : 'password'}
//         placeholder="Enter your password"
//         helperText="Must be at least 8 characters long."
//         rightIcon={
//           <button
//             type="button"
//             onClick={() => setShowPassword(!showPassword)}
//             className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
//           >
//             {showPassword ? 'Hide' : 'Show'}
//           </button>
//         }
//       />

//       {/* 4. Error State */}
//       <Input
//         label="Club Contact Email"
//         defaultValue="invalid-campus-email"
//         error="Please provide a valid UM6P or 1337 email address."
//       />

//       {/* 5. Disabled State */}
//       <Input
//         label="Campus ID"
//         value="1337-BG-0042"
//         disabled
//         helperText="Campus IDs are read-only and locked to your session."
//       />

//       <div className="pt-2">
//         <Button variant="primary" className="w-full">
//           Submit Form
//         </Button>
//       </div>
//     </main>
//   );
// }

//  *************************************************BADGE
// 
// 'use client';

// import React, { useState } from 'react';
// import { Badge } from '@/components/ui/Badge';
// import { EventCategory } from '@/types/api';

// const CATEGORIES: EventCategory[] = ['Tech', 'Media', 'Music', 'Sports', 'Business'];

// export default function Home() {
//   const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'All'>('All');

//   return (
//     <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 space-y-8">
//       <div>
//         <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
//           Badge Verification Bench
//         </h1>
//         <p className="text-sm text-slate-500">
//           Testing semantic status variants, event category colors, and interactive filter chips.
//         </p>
//       </div>

//       {/* 1. Status Badges with Dots */}
//       <section className="space-y-3">
//         <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
//           1. Semantic Status Badges (hasDot)
//         </h2>
//         <div className="flex flex-wrap gap-3 items-center">
//           <Badge variant="success" hasDot>RSVP Confirmed</Badge>
//           <Badge variant="warning" hasDot>Starts in 1 hour</Badge>
//           <Badge variant="danger" hasDot>Event Canceled</Badge>
//           <Badge variant="neutral" hasDot>Draft</Badge>
//         </div>
//       </section>

//       {/* 2. Status Badges without Dots */}
//       <section className="space-y-3">
//         <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
//           2. Semantic Badges (Plain)
//         </h2>
//         <div className="flex flex-wrap gap-3 items-center">
//           <Badge variant="success">Active</Badge>
//           <Badge variant="warning">Pending Review</Badge>
//           <Badge variant="danger">Closed</Badge>
//           <Badge variant="neutral">Archived</Badge>
//         </div>
//       </section>

//       {/* 3. Event Categories */}
//       <section className="space-y-3">
//         <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
//           3. Event Category Badges
//         </h2>
//         <div className="flex flex-wrap gap-2 items-center">
//           {CATEGORIES.map((cat) => (
//             <Badge key={cat} variant={cat}>
//               {cat}
//             </Badge>
//           ))}
//         </div>
//       </section>

//       {/* 4. Interactive Filter Chips */}
//       <section className="space-y-3">
//         <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
//           4. Clickable Filter Chips (Toggle Active State)
//         </h2>
//         <div className="flex flex-wrap gap-2 items-center">
//           <Badge
//             isClickable
//             isActive={selectedCategory === 'All'}
//             onClick={() => setSelectedCategory('All')}
//           >
//             All Categories
//           </Badge>
//           {CATEGORIES.map((cat) => (
//             <Badge
//               key={cat}
//               isClickable
//               isActive={selectedCategory === cat}
//               onClick={() => setSelectedCategory(cat)}
//             >
//               {cat}
//             </Badge>
//           ))}
//         </div>
//         <p className="text-xs text-slate-500">
//           Active selection: <span className="font-semibold text-violet-600">{selectedCategory}</span>
//         </p>
//       </section>
//     </main>
//   );
// }


// // ************************* BUTTONS 


// 'use client';

// import React, { useState } from 'react';
// import { Button } from '@/components/ui/Button';

// export default function Home() {
//   const [loading, setLoading] = useState(false);

//   return (
//     <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 space-y-8">
//       <div>
//         <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
//           Component #1: Button Preview
//         </h1>
//         <p className="text-sm text-slate-500">Testing variants, sizes, and states.</p>
//       </div>

//       <div className="space-y-4">
//         <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Variants</h2>
//         <div className="flex flex-wrap gap-3 items-center">
//           <Button variant="primary">Primary</Button>
//           <Button variant="secondary">Secondary</Button>
//           <Button variant="danger">Danger</Button>
//           <Button variant="ghost">Ghost</Button>
//         </div>
//       </div>

//       <div className="space-y-4">
//         <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sizes</h2>
//         <div className="flex flex-wrap gap-3 items-center">
//           <Button size="sm">Small</Button>
//           <Button size="md">Medium</Button>
//           <Button size="lg">Large</Button>
//         </div>
//       </div>

//       <div className="space-y-4">
//         <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">States</h2>
//         <div className="flex flex-wrap gap-3 items-center">
//           <Button disabled>Disabled</Button>
//           <Button isLoading={loading} onClick={() => setLoading(!loading)}>
//             {loading ? 'Processing...' : 'Click to Load'}
//           </Button>
//           <Button variant="secondary" leftIcon={<span>←</span>}>
//             Back
//           </Button>
//           <Button variant="primary" rightIcon={<span>→</span>}>
//             Next
//           </Button>
//         </div>
//       </div>
//     </main>
//   );
// }


// 

'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
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

export default function Home() {
  const [selectedCampus, setSelectedCampus] = useState('all');

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Tabs Verification Bench
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Testing controlled state, WAI-ARIA tab navigation, and campus-scoped event feeds.
        </p>
      </div>

      {/* Campus Selector Tabs */}
      <Tabs
        value={selectedCampus}
        onValueChange={setSelectedCampus}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList variant="segmented">
            <TabsTrigger value="all">All Campus</TabsTrigger>
            <TabsTrigger value="1337">1337 Benguerir</TabsTrigger>
            <TabsTrigger value="emines">EMINES School</TabsTrigger>
          </TabsList>

          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Filter: <span className="text-violet-600 dark:text-violet-400">{selectedCampus}</span>
          </span>
        </div>

        {/* Panel 1: All Campus Feed */}
        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card isHoverable>
              <CardBanner
                src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80"
                overlay={
                  <>
                    <Badge variant="Tech">Tech</Badge>
                    <Badge variant="neutral">Shared Campus</Badge>
                  </>
                }
              />
              <CardHeader>
                <CardTitle>UM6P Inter-School AI Hackathon</CardTitle>
                <CardDescription>Friday • 14:00 • Agora Conference Hall</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300">
                  Joint challenge between 1337 developers and EMINES project managers to ship real-world LLM products.
                </p>
              </CardContent>
              <CardFooter className="pt-3">
                <span className="text-xs text-slate-500">120 Participants</span>
                <Button size="sm" variant="primary">RSVP</Button>
              </CardFooter>
            </Card>

            <Card isHoverable>
              <CardBanner
                overlay={
                  <>
                    <Badge variant="Media">Media</Badge>
                    <Badge variant="success" hasDot>Open Seats</Badge>
                  </>
                }
              />
              <CardHeader>
                <CardTitle>Campus Photography & Lighting Lab</CardTitle>
                <CardDescription>Saturday • 18:00 • Studio 3</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300">
                  Hands-on lighting and framing fundamentals for event coverage and club media teams.
                </p>
              </CardContent>
              <CardFooter className="pt-3">
                <span className="text-xs text-slate-500">15 Seats Remaining</span>
                <Button size="sm" variant="secondary">Details</Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Panel 2: 1337 Exclusive Feed */}
        <TabsContent value="1337" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card isHoverable>
              <CardBanner
                overlay={
                  <>
                    <Badge variant="Tech">Tech</Badge>
                    <Badge variant="warning" hasDot>1337 Only</Badge>
                  </>
                }
              />
              <CardHeader>
                <CardTitle>42 Network: C++ Memory & Allocators</CardTitle>
                <CardDescription>Wednesday • 20:00 • Cluster 1</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300">
                  Custom allocators, cache-friendly data structures, and debugging memory leaks for graphics projects.
                </p>
              </CardContent>
              <CardFooter className="pt-3">
                <span className="text-xs text-slate-500">Peer Learning Session</span>
                <Button size="sm" variant="primary">Join Session</Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Panel 3: EMINES Exclusive Feed */}
        <TabsContent value="emines" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card isHoverable>
              <CardBanner
                overlay={
                  <>
                    <Badge variant="Business">Business</Badge>
                    <Badge variant="neutral">EMINES Only</Badge>
                  </>
                }
              />
              <CardHeader>
                <CardTitle>Supply Chain Optimization Case Study</CardTitle>
                <CardDescription>Thursday • 15:30 • Amphitheater B</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300">
                  Simulating industrial supply network constraints and inventory management strategies.
                </p>
              </CardContent>
              <CardFooter className="pt-3">
                <span className="text-xs text-slate-500">Guest Lecturer</span>
                <Button size="sm" variant="secondary">Register</Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}