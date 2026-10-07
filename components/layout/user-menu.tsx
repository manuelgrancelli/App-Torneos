"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/auth";
import { getInitials } from "@/lib/utils/text";

const SIGN_OUT_FORM_ID = "sign-out-form";

export function UserMenu({ user }: { user: CurrentUser }) {
  return (
    <>
      {/* El form vive fuera del menú: así el submit no se pierde cuando el menú se cierra. */}
      <form id={SIGN_OUT_FORM_ID} action={signOut} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Menú de usuario (Mi perfil)"
            title="Mi perfil"
          >
            <Avatar className="size-8">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-xs">{getInitials(user.fullName)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/perfil">
              <UserRound aria-hidden="true" />
              Mi perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <button type="submit" form={SIGN_OUT_FORM_ID} className="w-full">
              <LogOut aria-hidden="true" />
              Cerrar sesión
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
