# What to say to Code

Put this folder in the repository at `design/v1/`, with Dom's icons and screenshots beside it in
`design/v1/reference/`, then:

> Read `design/v1/DESIGN.md` from top to bottom before touching anything, then open `design/v1/screens/index.html`.
> Build the Shrug.VIP v1 apps it describes into the desktop (`src/`), in the order section 0 gives, one step at a
> time, leaving the desktop working after each.
>
> Three rules decide between sources. For flow, states and copy, the screens are right. For look, a screenshot in
> `design/v1/reference/` beats a screen. For the store, the code already in `store/` is right: reuse it inside a
> window and do not restyle it.
>
> Do not build Workspace: it is not in this handover. Do not build the pack screens: the pack opening stays as it
> is built today and only moves into the store window. Use the icons in `design/v1/reference/` where one is
> supplied.
>
> Lift markup and class names from the screens as they are; `screens/shrugos.css` is organized as one block per
> app. Before you start the store, check where a Mac app would put the Store / My VIP switch and the points, and
> tell me what you found. Stop and ask about anything in section 6 before it blocks you.
>
> Done means what the end of section 0 says. Update the checks in `tests/` for what changed and run them.
